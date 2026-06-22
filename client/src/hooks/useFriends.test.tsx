// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

const getFriendships = vi.fn();
const sendFriendRequest = vi.fn();
const respondToFriendRequest = vi.fn();
const removeFriend = vi.fn();
const useLoginContext = vi.fn();
const useAuth = vi.fn();

vi.mock("../services/friendService.ts", () => ({
  getFriendships: (...args: unknown[]) => getFriendships(...args),
  sendFriendRequest: (...args: unknown[]) => sendFriendRequest(...args),
  respondToFriendRequest: (...args: unknown[]) => respondToFriendRequest(...args),
  removeFriend: (...args: unknown[]) => removeFriend(...args),
}));

vi.mock("./useLoginContext.ts", () => ({
  default: () => useLoginContext(),
}));

vi.mock("./useAuth.ts", () => ({
  default: () => useAuth(),
}));

import useFriends from "./useFriends.ts";

const auth = { username: "me", password: "pw" };

const sampleFriendships = [
  { _id: "f1", requester: "me", recipient: "alice", status: "accepted" },
  { _id: "f2", requester: "bob", recipient: "me", status: "pending" },
];

beforeEach(() => {
  vi.clearAllMocks();
  useLoginContext.mockReturnValue({ user: { username: "me" } });
  useAuth.mockReturnValue(auth);
});

describe("useFriends", () => {
  it("loads friendships on mount", async () => {
    getFriendships.mockResolvedValue(sampleFriendships);

    const { result } = renderHook(() => useFriends());

    expect(result.current.friendships).toBeNull();
    expect(result.current.error).toBeNull();

    await waitFor(() => expect(result.current.friendships).toEqual(sampleFriendships));
    expect(result.current.error).toBeNull();
    expect(getFriendships).toHaveBeenCalledWith("me");
  });

  it("sets an error message when the load rejects", async () => {
    getFriendships.mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useFriends());

    await waitFor(() => expect(result.current.error).toBe("Error: boom"));
    expect(result.current.friendships).toBeNull();
  });

  it("sends a friend request then refreshes the list", async () => {
    getFriendships.mockResolvedValueOnce(sampleFriendships);
    sendFriendRequest.mockResolvedValue(undefined);

    const { result } = renderHook(() => useFriends());
    await waitFor(() => expect(result.current.friendships).toEqual(sampleFriendships));

    const refreshed = [
      ...sampleFriendships,
      { _id: "f3", requester: "me", recipient: "carol", status: "pending" },
    ];
    getFriendships.mockResolvedValueOnce(refreshed);

    await act(async () => {
      await result.current.sendRequest("carol");
    });

    expect(sendFriendRequest).toHaveBeenCalledWith(auth, "carol");
    await waitFor(() => expect(result.current.friendships).toEqual(refreshed));
    expect(getFriendships).toHaveBeenCalledTimes(2);
  });

  it("responds to a friend request then refreshes", async () => {
    getFriendships.mockResolvedValue(sampleFriendships);
    respondToFriendRequest.mockResolvedValue(undefined);

    const { result } = renderHook(() => useFriends());
    await waitFor(() => expect(result.current.friendships).toEqual(sampleFriendships));

    await act(async () => {
      await result.current.respond("f2", "accepted");
    });

    expect(respondToFriendRequest).toHaveBeenCalledWith(auth, "f2", "accepted");
    expect(getFriendships).toHaveBeenCalledTimes(2);
  });

  it("removes a friend then refreshes", async () => {
    getFriendships.mockResolvedValue(sampleFriendships);
    removeFriend.mockResolvedValue(undefined);

    const { result } = renderHook(() => useFriends());
    await waitFor(() => expect(result.current.friendships).toEqual(sampleFriendships));

    await act(async () => {
      await result.current.remove("f1");
    });

    expect(removeFriend).toHaveBeenCalledWith(auth, "f1");
    expect(getFriendships).toHaveBeenCalledTimes(2);
  });

  it("exposes a refresh callback that re-fetches", async () => {
    getFriendships.mockResolvedValue(sampleFriendships);

    const { result } = renderHook(() => useFriends());
    await waitFor(() => expect(result.current.friendships).toEqual(sampleFriendships));

    await act(async () => {
      result.current.refresh();
    });

    expect(getFriendships).toHaveBeenCalledTimes(2);
    expect(getFriendships).toHaveBeenLastCalledWith("me");
  });
});
