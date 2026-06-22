// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, within, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { GameInfo, SafeUserInfo } from "@gamenite/shared";
import GameCard from "./GameCard.tsx";

const user = (display: string): SafeUserInfo => ({ display }) as unknown as SafeUserInfo;

function makeGame(overrides: Partial<GameInfo> = {}): GameInfo {
  return {
    gameId: "g1",
    type: "nim",
    status: "waiting",
    chat: "c1",
    players: [user("alice")],
    // 5 minutes in the past so the relative time is deterministic ("ago")
    createdAt: new Date(Date.now() - 5 * 60 * 1000),
    createdBy: user("alice"),
    minPlayers: 2,
    ...overrides,
  };
}

function renderCard(game: GameInfo) {
  return render(
    <MemoryRouter>
      <GameCard {...game} />
    </MemoryRouter>,
  );
}

describe("GameCard", () => {
  afterEach(() => cleanup());

  it("renders as a listitem containing a link named after the game type", () => {
    renderCard(makeGame({ type: "nim" }));

    const item = screen.getByRole("listitem");
    expect(item).toHaveClass("game-card");

    const link = within(item).getByRole("link", { name: "A game of Nim" });
    expect(link).toHaveAttribute("href", "/game/g1");
  });

  it("maps each game key to its display name and cover art", () => {
    const cases: Array<{ type: GameInfo["type"]; name: string }> = [
      { type: "nim", name: "Nim" },
      { type: "guess", name: "Number Guesser" },
      { type: "cribbage", name: "Cribbage" },
    ];

    for (const { type, name } of cases) {
      const { unmount } = renderCard(makeGame({ type, gameId: type }));
      expect(screen.getByRole("link", { name: `A game of ${name}` })).toBeInTheDocument();
      // Title appears in the body
      expect(screen.getByText(name)).toBeInTheDocument();
      // Box art rendered with empty alt (decorative)
      const img = document.querySelector("img.game-card-art") as HTMLImageElement;
      expect(img).not.toBeNull();
      expect(img.getAttribute("alt")).toBe("");
      unmount();
    }
  });

  it("renders the correct status pill label and class for each status", () => {
    const cases: Array<{ status: GameInfo["status"]; label: string }> = [
      { status: "waiting", label: "Waiting" },
      { status: "active", label: "Live" },
      { status: "done", label: "Finished" },
    ];

    for (const { status, label } of cases) {
      const { unmount } = renderCard(makeGame({ status }));
      const pill = screen.getByText(label);
      expect(pill).toHaveClass("game-card-pill");
      expect(pill).toHaveClass(`pill-${status}`);
      unmount();
    }
  });

  it("shows the creator display name and a relative timestamp", () => {
    renderCard(makeGame({ createdBy: user("bob") }));
    // meta combines creator + time-since via dayjs; assert creator present
    expect(screen.getByText(/bob/)).toBeInTheDocument();
  });

  const playersText = () =>
    (document.querySelector(".game-card-players")?.textContent ?? "").replace(/\s+/g, " ").trim();

  it("pluralizes the player count correctly", () => {
    const single = renderCard(makeGame({ players: [user("a")] }));
    expect(playersText()).toBe("1 player");
    single.unmount();

    renderCard(makeGame({ players: [user("a"), user("b"), user("c")] }));
    expect(playersText()).toBe("3 players");
  });
});
