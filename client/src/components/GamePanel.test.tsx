// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { MemoryRouter } from "react-router-dom";
import type { GameInfo, SafeUserInfo } from "@gamenite/shared";

// ---- Mocks -----------------------------------------------------------------

const navigateMock = vi.fn();
let locationState: { autoJoin?: boolean } | null = null;

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
    useLocation: () => ({ state: locationState }),
  };
});

vi.mock("./GamePanel.css", () => ({}));

vi.mock("../hooks/useLoginContext.ts", () => ({
  default: () => ({ user: { username: "me", display: "Me" } }),
}));

vi.mock("../hooks/useTimeSince.ts", () => ({
  default: () => (_date: string | Date) => "5 minutes ago",
}));

// GameDispatch pulls in auth/socket deps; stub it out so we can assert it renders.
vi.mock("../games/GameDispatch.tsx", () => ({
  default: (props: { gameId: string }) => (
    <div data-testid="game-dispatch">dispatch:{props.gameId}</div>
  ),
}));

// Controllable return value for the sockets hook.
const joinGame = vi.fn();
const leaveGame = vi.fn();
const startGame = vi.fn();

type SocketsReturn = {
  view: unknown;
  players: SafeUserInfo[];
  userPlayerIndex: number;
  hasWatched: boolean;
  gameError: string | null;
  notice: string | null;
  joinGame: typeof joinGame;
  leaveGame: typeof leaveGame;
  startGame: typeof startGame;
};

let socketsReturn: SocketsReturn;

vi.mock("../hooks/useSocketsForGame.ts", () => ({
  default: () => socketsReturn,
}));

// ---- Helpers ---------------------------------------------------------------

const mkUser = (username: string, display = username): SafeUserInfo =>
  ({ username, display }) as SafeUserInfo;

const baseProps: GameInfo = {
  gameId: "g1",
  type: "nim",
  players: [],
  createdAt: new Date("2020-01-01").toISOString(),
  minPlayers: 2,
} as unknown as GameInfo;

const renderPanel = (props: Partial<GameInfo> = {}) =>
  render(
    <MemoryRouter>
      <GamePanel {...baseProps} {...props} />
    </MemoryRouter>,
  );

// Import after mocks are registered.
import GamePanel from "./GamePanel.tsx";

beforeEach(() => {
  vi.clearAllMocks();
  locationState = null;
  socketsReturn = {
    view: null,
    players: [],
    userPlayerIndex: -1,
    hasWatched: true,
    gameError: null,
    notice: null,
    joinGame,
    leaveGame,
    startGame,
  };
});

afterEach(() => {
  cleanup();
});

// ---- Tests -----------------------------------------------------------------

describe("GamePanel", () => {
  it("renders an empty placeholder before the game is watched", () => {
    socketsReturn.hasWatched = false;
    const { container } = renderPanel();
    expect(container.querySelector(".gamePanel")).toBeNull();
    expect(screen.queryByText("Nim")).not.toBeInTheDocument();
  });

  it("renders lobby with title, room age, and waiting placeholder", () => {
    renderPanel();
    expect(screen.getByText("Nim")).toBeInTheDocument();
    expect(screen.getByText("Room created 5 minutes ago")).toBeInTheDocument();
    expect(screen.getByText("waiting for game to begin")).toBeInTheDocument();
    expect(screen.getByText("0 of 2 players needed to start")).toBeInTheDocument();
  });

  it("shows a Join Game button and calls joinGame on click when not joined", () => {
    renderPanel();
    const btn = screen.getByRole("button", { name: "Join Game" });
    fireEvent.click(btn);
    expect(joinGame).toHaveBeenCalledTimes(1);
  });

  it("renders one chip per player and highlights the current user", () => {
    socketsReturn.players = [mkUser("me", "Me"), mkUser("alice", "Alice")];
    socketsReturn.userPlayerIndex = 0;
    renderPanel({ players: socketsReturn.players });
    expect(screen.getByText("you are player #1")).toBeInTheDocument();
    expect(screen.getByText("Player #2 is Alice")).toBeInTheDocument();
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0].className).toContain("isYou");
  });

  it("shows Start Game when joined and enough players, and calls startGame", () => {
    socketsReturn.players = [mkUser("me"), mkUser("alice")];
    socketsReturn.userPlayerIndex = 0;
    renderPanel({ players: socketsReturn.players });
    const start = screen.getByRole("button", { name: "Start Game" });
    fireEvent.click(start);
    expect(startGame).toHaveBeenCalledTimes(1);
  });

  it("does not show Start Game when below minPlayers", () => {
    socketsReturn.players = [mkUser("me")];
    socketsReturn.userPlayerIndex = 0;
    renderPanel({ players: socketsReturn.players });
    expect(screen.queryByRole("button", { name: "Start Game" })).not.toBeInTheDocument();
  });

  it("Leave Game in lobby leaves and navigates to /games", () => {
    socketsReturn.players = [mkUser("me"), mkUser("alice")];
    socketsReturn.userPlayerIndex = 0;
    renderPanel({ players: socketsReturn.players });
    fireEvent.click(screen.getByRole("button", { name: "Leave Game" }));
    expect(leaveGame).toHaveBeenCalledTimes(1);
    expect(navigateMock).toHaveBeenCalledWith("/games");
  });

  it("renders the live board and abandon label when a view is present", () => {
    socketsReturn.view = { type: "nim" };
    socketsReturn.players = [mkUser("me"), mkUser("alice")];
    socketsReturn.userPlayerIndex = 0;
    renderPanel({ players: socketsReturn.players });
    expect(screen.getByTestId("game-dispatch")).toHaveTextContent("dispatch:g1");
    expect(screen.getByRole("button", { name: "Leave / Abandon game" })).toBeInTheDocument();
    expect(screen.queryByText("waiting for game to begin")).not.toBeInTheDocument();
  });

  it("renders a game error alert and hides join button", () => {
    socketsReturn.gameError = "Cannot join";
    renderPanel();
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Cannot join");
  });

  it("renders a notice message", () => {
    socketsReturn.notice = "Heads up";
    renderPanel();
    expect(screen.getByText("Heads up")).toBeInTheDocument();
  });

  it("uses singular wording when minPlayers is 1", () => {
    renderPanel({ minPlayers: 1 });
    expect(screen.getByText("0 of 1 player needed to start")).toBeInTheDocument();
  });

  it("auto-joins once when arriving with autoJoin location state, showing Joining…", () => {
    vi.useFakeTimers();
    try {
      locationState = { autoJoin: true };
      renderPanel();
      // The auto-join effect should have fired joinGame once.
      expect(joinGame).toHaveBeenCalledTimes(1);
      // While joining and not yet a player, a disabled "Joining…" button shows.
      const joiningBtn = screen.getByRole("button", { name: "Joining…" });
      expect(joiningBtn).toBeDisabled();

      // Advance the retry timer to trigger a quiet retry.
      act(() => {
        vi.advanceTimersByTime(2500);
      });
      expect(joinGame).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
