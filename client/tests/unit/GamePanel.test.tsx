// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import type { GameInfo, SafeUserInfo } from "@gamenite/shared";

type SocketState = {
  view: unknown;
  players: SafeUserInfo[];
  userPlayerIndex: number;
  hasWatched: boolean;
  gameError: string | null;
  notice: string | null;
};

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  locationState: null as { autoJoin?: boolean } | null,
  socket: null as unknown as SocketState,
  joinGame: vi.fn(),
  leaveGame: vi.fn(),
  startGame: vi.fn(),
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
    useLocation: () => ({ state: mocks.locationState, pathname: "/game/g1" }),
  };
});

vi.mock("../../src/hooks/useLoginContext.ts", () => ({
  default: () => ({ user: { username: "me", display: "Me" } }),
}));

vi.mock("../../src/hooks/useTimeSince.ts", () => ({
  default: () => () => "1 minute ago",
}));

vi.mock("../../src/games/GameDispatch.tsx", () => ({
  default: () => <div data-testid="game-dispatch">board</div>,
}));

vi.mock("../../src/hooks/useSocketsForGame.ts", () => ({
  default: () => ({
    ...mocks.socket,
    joinGame: mocks.joinGame,
    leaveGame: mocks.leaveGame,
    startGame: mocks.startGame,
  }),
}));

import GamePanel from "../../src/components/GamePanel.tsx";

const user = (username: string, display: string): SafeUserInfo => ({
  username,
  display,
  createdAt: new Date("2024-01-01"),
});

const game = (overrides: Partial<GameInfo> = {}): GameInfo => ({
  gameId: "g1",
  type: "nim",
  status: "waiting",
  chat: "c1",
  players: [user("me", "Me")],
  createdAt: new Date("2024-01-01"),
  createdBy: user("me", "Me"),
  minPlayers: 2,
  ...overrides,
});

const renderPanel = (overrides: Partial<GameInfo> = {}) =>
  render(
    <MemoryRouter>
      <GamePanel {...game(overrides)} />
    </MemoryRouter>,
  );

beforeEach(() => {
  mocks.locationState = null;
  mocks.socket = {
    view: null,
    players: [],
    userPlayerIndex: -1,
    hasWatched: true,
    gameError: null,
    notice: null,
  };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("GamePanel", () => {
  it("renders an empty placeholder until the game has been watched", () => {
    mocks.socket = { ...mocks.socket, hasWatched: false };
    const { container } = renderPanel();
    expect(container.querySelector(".gamePanel")).toBeNull();
  });

  it("shows the lobby with a Join button when the user has not joined", () => {
    mocks.socket = { ...mocks.socket, players: [user("alice", "Alice")] };
    renderPanel();

    expect(screen.getByRole("heading", { name: "Nim" })).toBeInTheDocument();
    expect(screen.getByText("Room created 1 minute ago")).toBeInTheDocument();
    expect(screen.getByText(/Player #1 is Alice/)).toBeInTheDocument();
    expect(screen.getByText("1 of 2 players needed to start")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Join Game" }));
    expect(mocks.joinGame).toHaveBeenCalled();
  });

  it("highlights the current user's own chip", () => {
    mocks.socket = { ...mocks.socket, players: [user("me", "Me")], userPlayerIndex: 0 };
    renderPanel();
    expect(screen.getByText("you are player #1")).toBeInTheDocument();
  });

  it("shows Start Game once a joined player meets the minimum and can leave", () => {
    mocks.socket = {
      ...mocks.socket,
      players: [user("me", "Me"), user("bob", "Bob")],
      userPlayerIndex: 0,
    };
    renderPanel({ minPlayers: 2 });

    fireEvent.click(screen.getByRole("button", { name: "Start Game" }));
    expect(mocks.startGame).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Leave Game" }));
    expect(mocks.leaveGame).toHaveBeenCalled();
    expect(mocks.navigate).toHaveBeenCalledWith("/games");
  });

  it("does not show Start Game when below the minimum player count", () => {
    mocks.socket = { ...mocks.socket, players: [user("me", "Me")], userPlayerIndex: 0 };
    renderPanel({ minPlayers: 2 });
    expect(screen.queryByRole("button", { name: "Start Game" })).not.toBeInTheDocument();
  });

  it("renders the live board and an abandon label once a view exists", () => {
    mocks.socket = {
      ...mocks.socket,
      view: { type: "nim", view: {} },
      players: [user("me", "Me")],
      userPlayerIndex: 0,
    };
    renderPanel();

    expect(screen.getByTestId("game-dispatch")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Leave / Abandon game" })).toBeInTheDocument();
  });

  it("shows a join error and a notice when present", () => {
    mocks.socket = { ...mocks.socket, gameError: "Game is full", notice: "Player left" };
    renderPanel();
    expect(screen.getByRole("alert")).toHaveTextContent("Game is full");
    expect(screen.getByText("Player left")).toBeInTheDocument();
  });

  it("uses the singular noun when only one player is needed", () => {
    mocks.socket = { ...mocks.socket, players: [] };
    renderPanel({ minPlayers: 1 });
    expect(screen.getByText("0 of 1 player needed to start")).toBeInTheDocument();
  });

  it("auto-joins from an accepted invite and shows a Joining… state", () => {
    vi.useFakeTimers();
    mocks.locationState = { autoJoin: true };
    mocks.socket = { ...mocks.socket, players: [user("alice", "Alice")] };
    renderPanel();

    // The auto-join effect fires once on mount.
    expect(mocks.joinGame).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Joining…" })).toBeDisabled();

    // The retry timer fires another silent join attempt.
    act(() => {
      vi.advanceTimersByTime(2500);
    });
    expect(mocks.joinGame).toHaveBeenCalledTimes(2);
  });
});
