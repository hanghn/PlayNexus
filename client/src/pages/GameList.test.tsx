// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import type { GameInfo } from "@gamenite/shared";

// Mock the data hook so GameList's own filtering/paging logic is exercised
// deterministically without any network/socket IO.
const mockUseGameList = vi.fn();
vi.mock("../hooks/useGameList.ts", () => ({
  default: () => mockUseGameList(),
}));

// Stub the child components so we test GameList in isolation. GameRow renders
// its gameId/status so we can assert which rows are visible.
vi.mock("../components/GameRow.tsx", () => ({
  default: ({ gameId, status }: GameInfo) => (
    <div data-testid="game-row" data-status={status}>
      {gameId}
    </div>
  ),
}));
vi.mock("../components/CreateGameMenu.tsx", () => ({
  default: ({ triggerClassName }: { triggerClassName?: string }) => (
    <button className={triggerClassName} data-testid="create-game-menu">
      create
    </button>
  ),
}));

// Avoid loading the real CSS through the test transform.
vi.mock("./GameList.css", () => ({}));

import GameList from "./GameList.tsx";

function makeGame(id: number, status: GameInfo["status"]): GameInfo {
  return {
    gameId: String(id),
    type: "nim",
    status,
    chat: `chat-${id}`,
    players: [],
    createdAt: new Date(0),
    createdBy: { username: "u", display: "U" } as GameInfo["createdBy"],
    minPlayers: 2,
  };
}

beforeEach(() => {
  mockUseGameList.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("GameList", () => {
  it("renders the empty state message when the hook returns a message object", () => {
    mockUseGameList.mockReturnValue({ message: "No games found..." });
    render(<GameList />);

    expect(screen.getByRole("heading", { name: /all games/i })).toBeInTheDocument();
    expect(screen.getByText(/no games yet — be the first to start one/i)).toBeInTheDocument();
    expect(screen.getByText("No games found...")).toBeInTheDocument();
    // No filter tablist should render in the empty state.
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    // CreateGameMenu always renders with the games-cta trigger class.
    expect(screen.getByTestId("create-game-menu")).toHaveClass("games-cta");
  });

  it("renders the singular sub-heading and filter counts for a single game", () => {
    mockUseGameList.mockReturnValue([makeGame(1, "active")]);
    render(<GameList />);

    expect(screen.getByText(/1 game to watch or join/i)).toBeInTheDocument();
    // No trailing "s" on the singular game.
    expect(screen.queryByText(/1 games to watch/i)).not.toBeInTheDocument();

    const tablist = screen.getByRole("tablist");
    const tabs = within(tablist).getAllByRole("tab");
    expect(tabs).toHaveLength(4);
    // "All" is selected by default.
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
  });

  it("computes per-status counts and shows the plural heading", () => {
    mockUseGameList.mockReturnValue([
      makeGame(1, "active"),
      makeGame(2, "active"),
      makeGame(3, "waiting"),
      makeGame(4, "done"),
    ]);
    render(<GameList />);

    expect(screen.getByText(/4 games to watch or join/i)).toBeInTheDocument();

    const allTab = screen.getByRole("tab", { name: /all/i });
    const liveTab = screen.getByRole("tab", { name: /live/i });
    const waitingTab = screen.getByRole("tab", { name: /waiting/i });
    const finishedTab = screen.getByRole("tab", { name: /finished/i });

    expect(within(allTab).getByText("4")).toBeInTheDocument();
    expect(within(liveTab).getByText("2")).toBeInTheDocument();
    expect(within(waitingTab).getByText("1")).toBeInTheDocument();
    expect(within(finishedTab).getByText("1")).toBeInTheDocument();

    // All four rows visible by default under the "all" filter.
    expect(screen.getAllByTestId("game-row")).toHaveLength(4);
  });

  it("filters the list when a status tab is clicked", () => {
    mockUseGameList.mockReturnValue([
      makeGame(1, "active"),
      makeGame(2, "waiting"),
      makeGame(3, "active"),
    ]);
    render(<GameList />);

    fireEvent.click(screen.getByRole("tab", { name: /live/i }));

    const rows = screen.getAllByTestId("game-row");
    expect(rows).toHaveLength(2);
    rows.forEach((r) => expect(r).toHaveAttribute("data-status", "active"));

    // The clicked tab becomes selected.
    expect(screen.getByRole("tab", { name: /live/i })).toHaveAttribute("aria-selected", "true");
  });

  it("shows a filter-specific empty message when a filter matches nothing", () => {
    mockUseGameList.mockReturnValue([makeGame(1, "active")]);
    render(<GameList />);

    fireEvent.click(screen.getByRole("tab", { name: /finished/i }));

    expect(screen.getByText(/no done games right now/i)).toBeInTheDocument();
    expect(screen.queryByTestId("game-row")).not.toBeInTheDocument();
  });

  it("paginates with a View more button and resets paging when the filter changes", () => {
    // 25 active games -> first page shows 20, View more reveals the rest.
    const games = Array.from({ length: 25 }, (_, i) => makeGame(i + 1, "active"));
    mockUseGameList.mockReturnValue(games);
    render(<GameList />);

    expect(screen.getAllByTestId("game-row")).toHaveLength(20);
    const moreButton = screen.getByRole("button", { name: /view more games/i });
    expect(moreButton).toHaveTextContent("(5 more)");

    fireEvent.click(moreButton);
    expect(screen.getAllByTestId("game-row")).toHaveLength(25);
    // No more "View more" once everything is shown.
    expect(screen.queryByRole("button", { name: /view more games/i })).not.toBeInTheDocument();

    // Switching filters restarts paging back to PAGE_SIZE.
    fireEvent.click(screen.getByRole("tab", { name: /live/i }));
    expect(screen.getAllByTestId("game-row")).toHaveLength(20);
    expect(screen.getByRole("button", { name: /view more games/i })).toBeInTheDocument();
  });
});
