// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import "@testing-library/jest-dom/vitest";

const { getGameById } = vi.hoisted(() => ({ getGameById: vi.fn() }));

vi.mock("../services/gameService.ts", () => ({
  getGameById: (id: string) => getGameById(id),
}));

// Stub the heavy child components so we isolate Game's own behavior and avoid
// pulling in sockets, login context, and game-specific boards.
vi.mock("../components/GamePanel.tsx", () => ({
  default: (props: { gameId?: string }) => (
    <div data-testid="game-panel">GamePanel:{props.gameId}</div>
  ),
}));
vi.mock("../components/ChatPanel.tsx", () => ({
  default: ({ chatId }: { chatId: string }) => (
    <div data-testid="chat-panel">ChatPanel:{chatId}</div>
  ),
}));
vi.mock("./Game.css", () => ({}));

import Game from "./Game.tsx";

const fakeGame = {
  gameId: "g1",
  chat: "chat-123",
  type: "cribbage",
  players: [],
  createdAt: new Date().toISOString(),
  minPlayers: 2,
} as never;

function renderGame(gameId = "g1") {
  return render(
    <MemoryRouter initialEntries={[`/game/${gameId}`]}>
      <Routes>
        <Route path="/game/:gameId" element={<Game />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Game", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders nothing until the game loads", () => {
    getGameById.mockReturnValue(new Promise(() => {}));
    const { container } = renderGame();
    expect(container.querySelector(".gameContainer")).toBeNull();
    expect(getGameById).toHaveBeenCalledWith("g1");
  });

  it("renders the panels once the game is fetched", async () => {
    getGameById.mockResolvedValue(fakeGame);
    renderGame();

    expect(await screen.findByTestId("game-panel")).toBeInTheDocument();
    expect(screen.getByTestId("chat-panel")).toHaveTextContent("chat-123");
  });

  it("starts with chat collapsed, then toggles it open and closed", async () => {
    getGameById.mockResolvedValue(fakeGame);
    const { container } = renderGame();
    await screen.findByTestId("game-panel");

    const gameContainer = container.querySelector(".gameContainer")!;
    // Chat starts collapsed.
    expect(gameContainer).toHaveClass("chatHidden");

    const chatToggle = screen.getByRole("button", { name: /show chat panel/i });
    expect(chatToggle).toHaveAttribute("aria-expanded", "false");
    expect(chatToggle).toHaveTextContent("Chat");

    fireEvent.click(chatToggle);
    expect(gameContainer).not.toHaveClass("chatHidden");
    const openToggle = screen.getByRole("button", { name: /hide chat panel/i });
    expect(openToggle).toHaveAttribute("aria-expanded", "true");
    expect(openToggle).toHaveTextContent("Hide chat");

    fireEvent.click(openToggle);
    expect(gameContainer).toHaveClass("chatHidden");
  });

  it("toggles full screen, hiding the chat button while maximized", async () => {
    getGameById.mockResolvedValue(fakeGame);
    const { container } = renderGame();
    await screen.findByTestId("game-panel");

    const gameContainer = container.querySelector(".gameContainer")!;
    const fsBtn = screen.getByRole("button", { name: /play full screen/i });
    expect(fsBtn).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(fsBtn);
    expect(gameContainer).toHaveClass("gameMaximized");
    const exitBtn = screen.getByRole("button", { name: /exit full screen/i });
    expect(exitBtn).toHaveAttribute("aria-pressed", "true");
    // The chat toggle is hidden while expanded.
    expect(screen.queryByRole("button", { name: /chat panel/i })).toBeNull();

    fireEvent.click(exitBtn);
    expect(gameContainer).not.toHaveClass("gameMaximized");
    expect(screen.getByRole("button", { name: /show chat panel/i })).toBeInTheDocument();
  });

  it("expanding while chat is open keeps the chat hidden visually", async () => {
    getGameById.mockResolvedValue(fakeGame);
    const { container } = renderGame();
    await screen.findByTestId("game-panel");

    const gameContainer = container.querySelector(".gameContainer")!;
    fireEvent.click(screen.getByRole("button", { name: /show chat panel/i }));
    expect(gameContainer).not.toHaveClass("chatHidden");

    fireEvent.click(screen.getByRole("button", { name: /play full screen/i }));
    // expanded forces chatVisible false -> chatHidden class returns.
    expect(gameContainer).toHaveClass("chatHidden", "gameMaximized");
  });

  it("renders nothing when fetching the game rejects", async () => {
    getGameById.mockRejectedValue(new Error("boom"));
    const { container } = renderGame();
    // give the rejected promise a tick to settle
    await waitFor(() => expect(getGameById).toHaveBeenCalled());
    expect(container.querySelector(".gameContainer")).toBeNull();
  });

  it("fetches using the gameId route param", async () => {
    getGameById.mockResolvedValue(fakeGame);
    renderGame("specific-id-42");
    await screen.findByTestId("game-panel");
    expect(getGameById).toHaveBeenCalledWith("specific-id-42");
    expect(getGameById).toHaveBeenCalledTimes(1);
  });
});
