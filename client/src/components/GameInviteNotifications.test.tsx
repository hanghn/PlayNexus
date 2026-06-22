// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// Mock the CSS import (Vite handles it, but keep it inert under Vitest).
vi.mock("./GameInviteNotifications.css", () => ({}));

// Control the hook's return so we exercise the component's rendering/branches
// deterministically without sockets, navigation, or services.
const accept = vi.fn();
const decline = vi.fn();
const dismissDecline = vi.fn();
const hookState: {
  invites: unknown[];
  declines: unknown[];
} = { invites: [], declines: [] };

vi.mock("../hooks/useGameInvites.ts", () => ({
  default: () => ({
    invites: hookState.invites,
    declines: hookState.declines,
    accept,
    decline,
    dismissDecline,
  }),
}));

import GameInviteNotifications from "./GameInviteNotifications.tsx";

function makeInvite(over: Record<string, unknown> = {}) {
  return {
    gameId: "g1",
    gameType: "nim",
    toUsername: "me",
    from: { username: "alice", display: "Alice" },
    ...over,
  };
}

function makeDecline(over: Record<string, unknown> = {}) {
  return {
    gameId: "g2",
    gameType: "cribbage",
    inviterUsername: "me",
    by: { username: "bob", display: "Bob" },
    ...over,
  };
}

describe("GameInviteNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hookState.invites = [];
    hookState.declines = [];
  });

  afterEach(() => {
    cleanup();
  });

  it("renders nothing when there are no invites or declines", () => {
    const { container } = render(<GameInviteNotifications />);
    expect(container.firstChild).toBeNull();
  });

  it("renders an invite toast with mapped game name and wires accept/decline", () => {
    hookState.invites = [makeInvite()];
    render(<GameInviteNotifications />);

    // Mapped game name from gameNames: nim -> "Nim"
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText(/invited you to play/i)).toHaveTextContent("Nim");

    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    expect(accept).toHaveBeenCalledTimes(1);
    expect(accept).toHaveBeenCalledWith(hookState.invites[0]);

    fireEvent.click(screen.getByRole("button", { name: "Decline" }));
    expect(decline).toHaveBeenCalledTimes(1);
    expect(decline).toHaveBeenCalledWith(hookState.invites[0]);
  });

  it("falls back to the raw gameType when not in gameNames", () => {
    hookState.invites = [makeInvite({ gameType: "chess", gameId: "gx" })];
    render(<GameInviteNotifications />);
    expect(screen.getByText(/invited you to play/i)).toHaveTextContent("chess");
  });

  it("renders a decline notice and wires the dismiss action", () => {
    hookState.declines = [makeDecline()];
    render(<GameInviteNotifications />);

    expect(screen.getByText("Bob")).toBeInTheDocument();
    // gameNames maps cribbage -> "Cribbage"
    expect(screen.getByText(/declined your/i)).toHaveTextContent("Cribbage");

    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(dismissDecline).toHaveBeenCalledTimes(1);
    expect(dismissDecline).toHaveBeenCalledWith("g2", "bob");
  });

  it("falls back to raw gameType in decline notices", () => {
    hookState.declines = [makeDecline({ gameType: "go", gameId: "gz" })];
    render(<GameInviteNotifications />);
    expect(screen.getByText(/declined your/i)).toHaveTextContent("go");
  });

  it("renders both invites and declines together", () => {
    hookState.invites = [
      makeInvite(),
      makeInvite({ gameId: "g3", from: { username: "carol", display: "Carol" } }),
    ];
    hookState.declines = [makeDecline()];
    render(<GameInviteNotifications />);

    expect(screen.getAllByRole("button", { name: "Accept" })).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Dismiss" })).toBeInTheDocument();
    expect(screen.getByText("Carol")).toBeInTheDocument();
  });
});
