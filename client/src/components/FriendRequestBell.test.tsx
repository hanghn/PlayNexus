// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { describe, it, expect, afterEach, vi } from "vitest";
import type { FriendshipInfo } from "@gamenite/shared";

// Shared, hoisted mock state so the mocked hook can read per-test values.
const mocks = vi.hoisted(() => ({
  incoming: [] as FriendshipInfo[],
  acceptFriendRequest: vi.fn(),
  rejectFriendRequest: vi.fn(),
}));

vi.mock("../hooks/useFriendRequests.ts", () => ({
  default: () => ({
    incomingRequests: mocks.incoming,
    loading: false,
    acceptFriendRequest: mocks.acceptFriendRequest,
    rejectFriendRequest: mocks.rejectFriendRequest,
  }),
}));

import FriendRequestBell from "./FriendRequestBell";

const user = (display: string, username: string) => ({
  display,
  username,
  createdAt: new Date(),
});

const request = (friendshipId: string, display: string, username: string): FriendshipInfo =>
  ({
    friendshipId,
    status: "pending",
    from: user(display, username),
    to: user("Me", "me"),
  }) as FriendshipInfo;

afterEach(() => {
  cleanup();
  mocks.incoming = [];
  vi.clearAllMocks();
});

describe("FriendRequestBell", () => {
  it("shows a generic label and no badge when there are no requests", () => {
    render(<FriendRequestBell />);
    const btn = screen.getByRole("button", { name: "Friend requests" });
    expect(btn).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("reports the pending count in the accessible label", () => {
    mocks.incoming = [request("f1", "Alice", "alice"), request("f2", "Bob", "bob")];
    render(<FriendRequestBell />);
    expect(screen.getByRole("button", { name: "Friend requests, 2 pending" })).toBeInTheDocument();
  });

  it("opens the menu and accepts or rejects a request by id", () => {
    mocks.incoming = [request("f1", "Alice", "alice")];
    render(<FriendRequestBell />);

    fireEvent.click(screen.getByRole("button", { name: "Friend requests, 1 pending" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    expect(mocks.acceptFriendRequest).toHaveBeenCalledWith("f1");

    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(mocks.rejectFriendRequest).toHaveBeenCalledWith("f1");
  });

  it("shows a count badge and lists the pending request names", () => {
    mocks.incoming = [request("f1", "Alice", "alice")];
    render(<FriendRequestBell />);

    const btn = screen.getByRole("button", { name: "Friend requests, 1 pending" });
    expect(btn).toHaveTextContent("1");

    fireEvent.click(btn);
    expect(screen.getByText("Friend Requests (1)")).toBeInTheDocument();
    expect(screen.getByText("@alice")).toBeInTheDocument();
  });

  it("opens an empty menu when there are no requests", () => {
    render(<FriendRequestBell />);
    fireEvent.click(screen.getByRole("button", { name: "Friend requests" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(screen.getByText("No pending friend requests.")).toBeInTheDocument();
  });

  it("closes the menu when Escape is pressed", () => {
    render(<FriendRequestBell />);
    const btn = screen.getByRole("button", { name: "Friend requests" });

    fireEvent.click(btn);
    expect(screen.getByRole("menu")).toBeInTheDocument();

    fireEvent.keyDown(btn, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    // A non-Escape key leaves the menu state untouched.
    fireEvent.click(btn);
    fireEvent.keyDown(btn, { key: "Enter" });
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("closes the menu when the backdrop is clicked", () => {
    const { container } = render(<FriendRequestBell />);
    fireEvent.click(screen.getByRole("button", { name: "Friend requests" }));

    const backdrop = container.querySelector(".fr-bell-backdrop");
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop!);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
