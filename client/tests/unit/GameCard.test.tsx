// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, afterEach, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import type { GameInfo, SafeUserInfo } from "@gamenite/shared";
import GameCard from "../../src/components/GameCard.tsx";

vi.mock("../../src/hooks/useTimeSince.ts", () => ({
  default: () => () => "2 hours ago",
}));

afterEach(cleanup);

const user = (username: string, display: string): SafeUserInfo => ({
  username,
  display,
  createdAt: new Date("2024-01-01"),
});

const game = (overrides: Partial<GameInfo> = {}): GameInfo => ({
  gameId: "g7",
  type: "cribbage",
  status: "active",
  chat: "c1",
  players: [user("alice", "Alice"), user("bob", "Bob")],
  createdAt: new Date("2024-01-01"),
  createdBy: user("alice", "Alice"),
  minPlayers: 2,
  ...overrides,
});

const renderCard = (overrides: Partial<GameInfo> = {}) =>
  render(
    <MemoryRouter>
      <GameCard {...game(overrides)} />
    </MemoryRouter>,
  );

describe("GameCard", () => {
  it("renders an accessible link, title, status pill, and creator", () => {
    renderCard({ type: "cribbage", status: "active" });
    expect(screen.getByRole("link", { name: "A game of Cribbage" })).toHaveAttribute(
      "href",
      "/game/g7",
    );
    expect(screen.getByText("Cribbage")).toBeInTheDocument();
    expect(screen.getByText("Live")).toBeInTheDocument();
    expect(screen.getByText(/Alice/)).toHaveTextContent("2 hours ago");
  });

  it("pluralizes a multi-player count", () => {
    renderCard({ players: [user("a", "A"), user("b", "B")] });
    expect(screen.getByText("2 players")).toBeInTheDocument();
  });

  it("uses the singular form for a single player", () => {
    renderCard({ players: [user("a", "A")] });
    expect(screen.getByText("1 player")).toBeInTheDocument();
  });

  it("labels waiting and finished statuses", () => {
    renderCard({ status: "waiting" });
    expect(screen.getByText("Waiting")).toBeInTheDocument();
    cleanup();
    renderCard({ status: "done", type: "guess" });
    expect(screen.getByText("Finished")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "A game of Number Guesser" })).toBeInTheDocument();
  });
});
