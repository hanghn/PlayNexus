// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { MemoryRouter } from "react-router-dom";
import GameSummaryView from "./GameSummaryView.tsx";
import { TimeContext } from "../contexts/TimeContext.tsx";

type Props = React.ComponentProps<typeof GameSummaryView>;

const baseUser = (display: string) =>
  ({ display, username: display.toLowerCase() }) as unknown as Props["createdBy"];

function makeProps(overrides: Partial<Props> = {}): Props {
  return {
    gameId: "game-123",
    type: "nim",
    status: "waiting",
    chat: "chat-1",
    players: [baseUser("Alice")],
    createdAt: new Date("2020-01-01T00:00:00.000Z"),
    createdBy: baseUser("Alice"),
    minPlayers: 2,
    ...overrides,
  };
}

function renderWith(props: Props, now: Date = new Date("2020-01-01T01:00:00.000Z")) {
  return render(
    <TimeContext.Provider value={now}>
      <MemoryRouter>
        <GameSummaryView {...props} />
      </MemoryRouter>
    </TimeContext.Provider>,
  );
}

describe("GameSummaryView", () => {
  afterEach(() => cleanup());

  it("renders status and singular player count for one player", () => {
    renderWith(makeProps({ status: "waiting", players: [baseUser("Alice")] }));
    const item = screen.getByRole("listitem");
    expect(item).toBeInTheDocument();
    // Singular: exactly "1 player" (no trailing s)
    expect(item.textContent).toContain("waiting");
    expect(item.textContent).toContain("1 player");
    expect(item.textContent).not.toContain("1 players");
  });

  it("renders plural player count for multiple players", () => {
    renderWith(
      makeProps({
        status: "active",
        players: [baseUser("Alice"), baseUser("Bob"), baseUser("Cara")],
      }),
    );
    const item = screen.getByRole("listitem");
    expect(item.textContent).toContain("active");
    expect(item.textContent).toContain("3 players");
  });

  it("hides player count when status is done", () => {
    renderWith(makeProps({ status: "done", players: [baseUser("Alice")] }));
    const item = screen.getByRole("listitem");
    expect(item.textContent).toContain("done");
    expect(item.textContent).not.toContain("player");
  });

  it("links to the game page using the gameId", () => {
    renderWith(makeProps({ gameId: "abc-789" }));
    const link = within(screen.getByRole("listitem")).getByRole("link");
    expect(link).toHaveAttribute("href", "/game/abc-789");
    expect(link).toHaveClass("mid");
  });

  it("displays the human-readable game name for the type", () => {
    renderWith(makeProps({ type: "cribbage" }));
    expect(screen.getByText(/A game of Cribbage/)).toBeInTheDocument();
  });

  it("shows who created the game with a relative time", () => {
    renderWith(
      makeProps({ createdBy: baseUser("Zelda"), createdAt: new Date("2020-01-01T00:00:00.000Z") }),
      new Date("2020-01-01T01:00:00.000Z"),
    );
    const activity = screen.getByText(/Zelda created/);
    expect(activity).toBeInTheDocument();
    // One hour difference => dayjs "an hour ago"
    expect(activity.textContent).toMatch(/ago/);
  });
});
