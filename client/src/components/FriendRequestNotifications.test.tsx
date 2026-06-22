// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

const acceptFriendRequest = vi.fn();
const rejectFriendRequest = vi.fn();

const hookState: {
  incomingRequests: Array<{
    friendshipId: string;
    createdAt: string;
    from: { display: string; username: string };
  }>;
  acceptFriendRequest: typeof acceptFriendRequest;
  rejectFriendRequest: typeof rejectFriendRequest;
  loading: boolean;
} = {
  incomingRequests: [],
  acceptFriendRequest,
  rejectFriendRequest,
  loading: false,
};

vi.mock("../hooks/useFriendRequests.ts", () => ({
  default: () => hookState,
}));

// CSS import is handled by Vitest, but mock to be safe/no-op.
vi.mock("./FriendRequestNotifications.css", () => ({}));

import FriendRequestNotifications from "./FriendRequestNotifications.tsx";

describe("FriendRequestNotifications", () => {
  beforeEach(() => {
    acceptFriendRequest.mockReset();
    rejectFriendRequest.mockReset();
    hookState.incomingRequests = [];
    hookState.loading = false;
  });

  afterEach(() => {
    cleanup();
  });

  it("renders a loading state while requests are loading", () => {
    hookState.loading = true;
    render(<FriendRequestNotifications />);
    expect(screen.getByText("Loading friend requests...")).toBeInTheDocument();
  });

  it("renders the empty state when there are no incoming requests", () => {
    hookState.incomingRequests = [];
    render(<FriendRequestNotifications />);
    expect(screen.getByText("Friend Requests (0)")).toBeInTheDocument();
    expect(screen.getByText("No pending friend requests.")).toBeInTheDocument();
  });

  it("renders each incoming request with sender info and formatted date", () => {
    hookState.incomingRequests = [
      {
        friendshipId: "fs-1",
        createdAt: "2023-01-15T00:00:00.000Z",
        from: { display: "Alice Smith", username: "alice" },
      },
      {
        friendshipId: "fs-2",
        createdAt: "2023-02-20T00:00:00.000Z",
        from: { display: "Bob Jones", username: "bob" },
      },
    ];
    render(<FriendRequestNotifications />);

    expect(screen.getByText("Friend Requests (2)")).toBeInTheDocument();
    expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    expect(screen.getByText("(@alice)")).toBeInTheDocument();
    expect(screen.getByText("Bob Jones")).toBeInTheDocument();
    expect(screen.getByText("(@bob)")).toBeInTheDocument();

    const expectedDate = new Date("2023-01-15T00:00:00.000Z").toLocaleDateString();
    expect(screen.getByText(expectedDate)).toBeInTheDocument();

    expect(screen.getAllByRole("button", { name: "Accept" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Reject" })).toHaveLength(2);
  });

  it("calls acceptFriendRequest with the friendshipId when Accept is clicked", () => {
    hookState.incomingRequests = [
      {
        friendshipId: "fs-42",
        createdAt: "2023-03-01T00:00:00.000Z",
        from: { display: "Carol", username: "carol" },
      },
    ];
    render(<FriendRequestNotifications />);

    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    expect(acceptFriendRequest).toHaveBeenCalledTimes(1);
    expect(acceptFriendRequest).toHaveBeenCalledWith("fs-42");
    expect(rejectFriendRequest).not.toHaveBeenCalled();
  });

  it("calls rejectFriendRequest with the friendshipId when Reject is clicked", () => {
    hookState.incomingRequests = [
      {
        friendshipId: "fs-99",
        createdAt: "2023-04-01T00:00:00.000Z",
        from: { display: "Dave", username: "dave" },
      },
    ];
    render(<FriendRequestNotifications />);

    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(rejectFriendRequest).toHaveBeenCalledTimes(1);
    expect(rejectFriendRequest).toHaveBeenCalledWith("fs-99");
    expect(acceptFriendRequest).not.toHaveBeenCalled();
  });
});
