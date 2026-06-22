// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { describe, it, expect, afterEach, vi } from "vitest";
import type { FriendshipInfo } from "@gamenite/shared";

const mocks = vi.hoisted(() => ({
  incoming: [] as FriendshipInfo[],
  loading: false,
  acceptFriendRequest: vi.fn(),
  rejectFriendRequest: vi.fn(),
}));

vi.mock("../../src/hooks/useFriendRequests.ts", () => ({
  default: () => ({
    incomingRequests: mocks.incoming,
    loading: mocks.loading,
    acceptFriendRequest: mocks.acceptFriendRequest,
    rejectFriendRequest: mocks.rejectFriendRequest,
  }),
}));

import FriendRequestNotifications from "../../src/components/FriendRequestNotifications.tsx";

const user = (display: string, username: string) => ({
  display,
  username,
  createdAt: new Date("2024-02-03"),
});

const request = (friendshipId: string, display: string, username: string): FriendshipInfo =>
  ({
    friendshipId,
    status: "pending",
    from: user(display, username),
    to: user("Me", "me"),
    createdAt: new Date("2024-02-03"),
  }) as FriendshipInfo;

afterEach(() => {
  cleanup();
  mocks.incoming = [];
  mocks.loading = false;
  vi.clearAllMocks();
});

describe("FriendRequestNotifications", () => {
  it("shows a loading message while requests are loading", () => {
    mocks.loading = true;
    render(<FriendRequestNotifications />);
    expect(screen.getByText("Loading friend requests...")).toBeInTheDocument();
  });

  it("shows an empty state with a zero count when there are no requests", () => {
    render(<FriendRequestNotifications />);
    expect(screen.getByText("Friend Requests (0)")).toBeInTheDocument();
    expect(screen.getByText("No pending friend requests.")).toBeInTheDocument();
  });

  it("lists requests and wires up accept/reject by id", () => {
    mocks.incoming = [request("f1", "Alice", "alice"), request("f2", "Bob", "bob")];
    render(<FriendRequestNotifications />);

    expect(screen.getByText("Friend Requests (2)")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("(@bob)")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Accept" })[0]);
    expect(mocks.acceptFriendRequest).toHaveBeenCalledWith("f1");

    fireEvent.click(screen.getAllByRole("button", { name: "Reject" })[1]);
    expect(mocks.rejectFriendRequest).toHaveBeenCalledWith("f2");
  });
});
