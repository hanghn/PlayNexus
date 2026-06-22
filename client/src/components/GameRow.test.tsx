// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, within, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom/vitest";
import type { GameInfo, GameKey, SafeUserInfo } from "@gamenite/shared";
import GameRow from "./GameRow.tsx";

function user(overrides: Partial<SafeUserInfo> = {}): SafeUserInfo {
  return {
    username: "alice",
    display: "Alice",
    createdAt: new Date("2020-01-01T00:00:00Z"),
    ...overrides,
  };
}

function makeGame(overrides: Partial<GameInfo> = {}): GameInfo {
  return {
    gameId: "game-123",
    type: "cribbage",
    status: "waiting",
    chat: "chat-1",
    players: [user(), user({ username: "bob", display: "Bob" })],
    // Far in the past so dayjs.fromNow() is deterministic ("... years ago").
    createdAt: new Date("2000-01-01T00:00:00Z"),
    createdBy: user({ display: "Creator" }),
    minPlayers: 2,
    ...overrides,
  };
}

function renderRow(game: GameInfo) {
  return render(
    <MemoryRouter>
      <GameRow {...game} />
    </MemoryRouter>,
  );
}

describe("GameRow", () => {
  afterEach(() => cleanup());

  it("renders a listitem with an accessibly-named link to the game", () => {
    renderRow(makeGame({ gameId: "abc", type: "cribbage" }));

    const item = screen.getByRole("listitem");
    expect(item).toHaveClass("game-row");

    const link = screen.getByRole("link", { name: "A game of Cribbage" });
    expect(link).toHaveAttribute("href", "/game/abc");
    expect(within(item).getByText("Cribbage")).toBeInTheDocument();
  });

  it("shows the creator display name and a relative time in the meta line", () => {
    renderRow(makeGame({ createdBy: user({ display: "Creator" }) }));

    // "Creator · <some time> ago" — both halves are present.
    expect(screen.getByText(/Creator/)).toBeInTheDocument();
    expect(screen.getByText(/ago/)).toBeInTheDocument();
  });

  it("pluralizes the player count and shows the Waiting pill while not done", () => {
    renderRow(makeGame({ status: "waiting", players: [user(), user({ username: "b" })] }));

    expect(screen.getByText("2 players")).toBeInTheDocument();
    const pill = screen.getByText("Waiting");
    expect(pill).toHaveClass("game-row-pill", "game-row-pill--waiting");
  });

  it("uses the singular 'player' form for a single player", () => {
    renderRow(makeGame({ status: "active", players: [user()] }));

    expect(screen.getByText("1 player")).toBeInTheDocument();
    expect(screen.getByText("Live")).toHaveClass("game-row-pill--active");
  });

  it("hides the player count for finished games and labels the pill 'Finished'", () => {
    renderRow(makeGame({ status: "done", players: [user(), user({ username: "b" })] }));

    expect(screen.queryByText(/player/)).not.toBeInTheDocument();
    const pill = screen.getByText("Finished");
    expect(pill).toHaveClass("game-row-pill--done");
  });

  it.each<[GameKey, string]>([
    ["cribbage", "Cribbage"],
    ["nim", "Nim"],
    ["guess", "Number Guesser"],
  ])("renders the cover art and title for %s", (type, name) => {
    renderRow(makeGame({ type }));

    expect(screen.getByRole("link", { name: `A game of ${name}` })).toBeInTheDocument();
    expect(screen.getByText(name)).toBeInTheDocument();

    // The thumbnail carries a per-game gradient and a decorative <img>.
    const thumb = document.querySelector(".game-row-thumb") as HTMLElement;
    expect(thumb).toBeTruthy();
    expect(thumb.getAttribute("style")).toContain("linear-gradient");
    expect(thumb.querySelector("img.game-row-art")).toBeTruthy();
  });
});
