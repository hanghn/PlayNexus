// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within, cleanup } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";

expect.extend(matchers);

const navigateMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigateMock };
});

const useThreadListMock = vi.fn();
const useGameListMock = vi.fn();
const timeSinceMock = vi.fn((d: unknown) => `time:${String(d)}`);

vi.mock("../hooks/useThreadList.ts", () => ({
  default: (...args: unknown[]) => useThreadListMock(...args),
}));
vi.mock("../hooks/useGameList.ts", () => ({
  default: (...args: unknown[]) => useGameListMock(...args),
}));
vi.mock("../hooks/useTimeSince.ts", () => ({
  default: () => timeSinceMock,
}));

// Stub the child components so Home is exercised in isolation.
vi.mock("../components/GameCard.tsx", () => ({
  default: (props: { gameId: number | string }) => (
    <div data-testid="game-card">game-{String(props.gameId)}</div>
  ),
}));
vi.mock("../components/CreateGameMenu.tsx", () => ({
  default: ({ triggerClassName }: { triggerClassName?: string }) => (
    <div data-testid="create-game-menu" data-trigger={triggerClassName} />
  ),
}));

import Home from "./Home";
import { MemoryRouter } from "react-router-dom";

function renderHome() {
  return render(
    <MemoryRouter>
      <Home />
    </MemoryRouter>,
  );
}

const games = [
  {
    gameId: 101,
    type: "nim",
    status: "active",
    players: [],
    createdAt: "2026-01-01",
    createdBy: { username: "a", display: "Alice" },
  },
  {
    gameId: 202,
    type: "cribbage",
    status: "waiting",
    players: [],
    createdAt: "2026-01-02",
    createdBy: { username: "b", display: "Bob" },
  },
];

const threads = [
  {
    threadId: 1,
    title: "First post",
    comments: 1,
    createdAt: "2026-02-01",
    createdBy: { username: "a", display: "Alice" },
  },
  {
    threadId: 2,
    title: "Second post",
    comments: 3,
    createdAt: "2026-02-02",
    createdBy: { username: "b", display: "Bob" },
  },
];

describe("Home", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    timeSinceMock.mockImplementation((d: unknown) => `time:${String(d)}`);
  });

  afterEach(() => {
    cleanup();
  });

  it("passes the configured limits to the list hooks", () => {
    useGameListMock.mockReturnValue({ message: "Loading..." });
    useThreadListMock.mockReturnValue({ message: "Loading..." });
    renderHome();
    expect(useGameListMock).toHaveBeenCalledWith(10);
    expect(useThreadListMock).toHaveBeenCalledWith(6);
  });

  it("renders empty/message states for both sections", () => {
    useGameListMock.mockReturnValue({ message: "No games found..." });
    useThreadListMock.mockReturnValue({ message: "Loading..." });
    renderHome();

    expect(screen.getByText("No games found...")).toBeInTheDocument();
    expect(screen.getByText("Loading...")).toBeInTheDocument();
    // No grid/list rendered in the message branch.
    expect(screen.queryByRole("list", { name: "Recent games" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("game-card")).not.toBeInTheDocument();
    // The CTAs still render.
    expect(screen.getByTestId("create-game-menu")).toHaveAttribute("data-trigger", "lobby-cta");
  });

  it("renders the game grid and forum posts when data is present", () => {
    useGameListMock.mockReturnValue(games);
    useThreadListMock.mockReturnValue(threads);
    renderHome();

    const grid = screen.getByRole("list", { name: "Recent games" });
    expect(within(grid).getAllByTestId("game-card")).toHaveLength(2);
    expect(screen.getByText("game-101")).toBeInTheDocument();
    expect(screen.getByText("game-202")).toBeInTheDocument();

    // Thread titles render.
    expect(screen.getByText("First post")).toBeInTheDocument();
    expect(screen.getByText("Second post")).toBeInTheDocument();

    // Singular vs plural reply text plus the timeSince result.
    expect(screen.getByText(/Alice · 1 reply · time:2026-02-01/)).toBeInTheDocument();
    expect(screen.getByText(/Bob · 3 replies · time:2026-02-02/)).toBeInTheDocument();
    expect(timeSinceMock).toHaveBeenCalledWith("2026-02-01");
    expect(timeSinceMock).toHaveBeenCalledWith("2026-02-02");
  });

  it("navigates from the header and CTA buttons", () => {
    useGameListMock.mockReturnValue({ message: "x" });
    useThreadListMock.mockReturnValue({ message: "y" });
    renderHome();

    fireEvent.click(screen.getByRole("button", { name: "All games →" }));
    expect(navigateMock).toHaveBeenCalledWith("/games");

    fireEvent.click(screen.getByRole("button", { name: "All posts →" }));
    expect(navigateMock).toHaveBeenCalledWith("/forum");

    fireEvent.click(screen.getByRole("button", { name: "+ Create New Post" }));
    expect(navigateMock).toHaveBeenCalledWith("/forum/post/new");
  });

  it("navigates to a specific thread when a post card is clicked", () => {
    useGameListMock.mockReturnValue({ message: "x" });
    useThreadListMock.mockReturnValue(threads);
    renderHome();

    fireEvent.click(screen.getByText("First post"));
    expect(navigateMock).toHaveBeenCalledWith("/forum/post/1");
  });
});
