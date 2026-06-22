// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { describe, it, expect, afterEach, vi } from "vitest";
import type { GameInvitationInfo, GameInviteDeclinedInfo, SafeUserInfo } from "@gamenite/shared";

const mocks = vi.hoisted(() => ({
  invites: [] as GameInvitationInfo[],
  declines: [] as GameInviteDeclinedInfo[],
  accept: vi.fn(),
  decline: vi.fn(),
  dismissDecline: vi.fn(),
}));

vi.mock("../../src/hooks/useGameInvites.ts", () => ({
  default: () => ({
    invites: mocks.invites,
    declines: mocks.declines,
    accept: mocks.accept,
    decline: mocks.decline,
    dismissDecline: mocks.dismissDecline,
  }),
}));

import GameInviteNotifications from "../../src/components/GameInviteNotifications.tsx";

const user = (username: string, display: string): SafeUserInfo => ({
  username,
  display,
  createdAt: new Date("2024-01-01"),
});

const invite = (overrides: Partial<GameInvitationInfo> = {}): GameInvitationInfo => ({
  gameId: "g1",
  gameType: "nim",
  from: user("alice", "Alice"),
  toUsername: "me",
  createdAt: new Date("2024-01-01"),
  ...overrides,
});

const declined = (overrides: Partial<GameInviteDeclinedInfo> = {}): GameInviteDeclinedInfo => ({
  gameId: "g2",
  gameType: "cribbage",
  by: user("bob", "Bob"),
  inviterUsername: "me",
  ...overrides,
});

afterEach(() => {
  cleanup();
  mocks.invites = [];
  mocks.declines = [];
  vi.clearAllMocks();
});

describe("GameInviteNotifications", () => {
  it("renders nothing when there are no invites or declines", () => {
    const { container } = render(<GameInviteNotifications />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows an invite toast and wires accept/decline", () => {
    mocks.invites = [invite()];
    render(<GameInviteNotifications />);

    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText(/play\s*Nim/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    expect(mocks.accept).toHaveBeenCalledWith(expect.objectContaining({ gameId: "g1" }));

    fireEvent.click(screen.getByRole("button", { name: "Decline" }));
    expect(mocks.decline).toHaveBeenCalledWith(expect.objectContaining({ gameId: "g1" }));
  });

  it("falls back to the raw game type when it is not a known game", () => {
    mocks.invites = [invite({ gameType: "mystery" as never })];
    render(<GameInviteNotifications />);
    expect(screen.getByText(/play\s*mystery/)).toBeInTheDocument();
  });

  it("shows decline notices to the inviter and dismisses them by id", () => {
    mocks.declines = [declined()];
    render(<GameInviteNotifications />);

    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText(/Cribbage/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(mocks.dismissDecline).toHaveBeenCalledWith("g2", "bob");
  });

  it("falls back to the raw type for declines of unknown games", () => {
    mocks.declines = [declined({ gameType: "mystery" as never })];
    render(<GameInviteNotifications />);
    expect(screen.getByText(/mystery/)).toBeInTheDocument();
  });
});
