// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, afterEach, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import type { GameInfo, SafeUserInfo } from "@gamenite/shared";
import GameSummaryView from "../../src/components/GameSummaryView.tsx";

vi.mock("../../src/hooks/useTimeSince.ts", () => ({
  default: () => () => "5 minutes ago",
}));

afterEach(cleanup);

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
  players: [user("alice", "Alice")],
  createdAt: new Date("2024-01-01"),
  createdBy: user("alice", "Alice"),
  minPlayers: 2,
  ...overrides,
});

const renderView = (overrides: Partial<GameInfo> = {}) =>
  render(
    <MemoryRouter>
      <GameSummaryView {...game(overrides)} />
    </MemoryRouter>,
  );

describe("GameSummaryView", () => {
  it("shows the game name, creator, and a player count for an open game", () => {
    renderView({ players: [user("alice", "Alice")] });
    expect(screen.getByRole("link", { name: "A game of Nim" })).toHaveAttribute("href", "/game/g1");
    expect(screen.getByText(/1 player$/)).toBeInTheDocument();
    expect(screen.getByText(/Alice created/)).toHaveTextContent("5 minutes ago");
  });

  it("pluralizes the player count for multiple players", () => {
    renderView({ players: [user("a", "A"), user("b", "B")] });
    expect(screen.getByText(/2 players/)).toBeInTheDocument();
  });

  it("hides the player count for finished games", () => {
    renderView({ status: "done" });
    expect(screen.queryByText(/player/)).not.toBeInTheDocument();
  });
});
