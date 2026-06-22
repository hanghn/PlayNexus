// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, afterEach, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import type { GameInfo, SafeUserInfo } from "@gamenite/shared";
import GameRow from "../../src/components/GameRow.tsx";

vi.mock("../../src/hooks/useTimeSince.ts", () => ({
  default: () => () => "yesterday",
}));

afterEach(cleanup);

const user = (username: string, display: string): SafeUserInfo => ({
  username,
  display,
  createdAt: new Date("2024-01-01"),
});

const game = (overrides: Partial<GameInfo> = {}): GameInfo => ({
  gameId: "g3",
  type: "nim",
  status: "waiting",
  chat: "c1",
  players: [user("alice", "Alice")],
  createdAt: new Date("2024-01-01"),
  createdBy: user("alice", "Alice"),
  minPlayers: 2,
  ...overrides,
});

const renderRow = (overrides: Partial<GameInfo> = {}) =>
  render(
    <MemoryRouter>
      <GameRow {...game(overrides)} />
    </MemoryRouter>,
  );

describe("GameRow", () => {
  it("renders the link, title, status, and singular player count when waiting", () => {
    renderRow({ status: "waiting", players: [user("alice", "Alice")] });
    expect(screen.getByRole("link", { name: "A game of Nim" })).toHaveAttribute("href", "/game/g3");
    expect(screen.getByText("Nim")).toBeInTheDocument();
    expect(screen.getByText("Waiting")).toBeInTheDocument();
    expect(screen.getByText("1 player")).toBeInTheDocument();
  });

  it("pluralizes the player count for multiple players", () => {
    renderRow({ players: [user("a", "A"), user("b", "B")] });
    expect(screen.getByText("2 players")).toBeInTheDocument();
  });

  it("hides the player count but keeps the status pill for finished games", () => {
    renderRow({ status: "done" });
    expect(screen.queryByText(/player/)).not.toBeInTheDocument();
    expect(screen.getByText("Finished")).toBeInTheDocument();
  });
});
