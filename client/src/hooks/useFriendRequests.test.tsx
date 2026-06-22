// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

const getFriendships = vi.fn();
const respondToFriendRequest = vi.fn();
const useLoginContext = vi.fn();
const useAuth = vi.fn();

vi.mock("../services/friendService.ts", () => ({
  getFriendships: (...args: unknown[]) => getFriendships(...args),
  respondToFriendRequest: (...args: unknown[]) => respondToFriendRequest(...args),
}));

vi.mock("./useLoginContext.ts", () => ({
  default: () => useLoginContext(),
}));

vi.mock("./useAuth.ts", () => ({
  default: () => useAuth(),
}));

import useFriendRequests from "./useFriendRequests.ts";

type SocketHandlers = Record<string, (...args: unknown[]) => void>;

function makeSocket() {
  const handlers: SocketHandlers = {};
  return {
    on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
      handlers[event] = cb;
    }),
    off: vi.fn((event: string) => {
      delete handlers[event];
    }),
    emit: (event: string, ...args: unknown[]) => handlers[event]?.(...args),
    handlers,
  };
}

const friendship = (id: string, status: string, toUser: string, fromUser = "x"): any => ({
  friendshipId: id,
  status,
  to: { username: toUser },
  from: { username: fromUser },
});

const auth = { username: "me", password: "pw" };

let errorSpy: MockInstance;

beforeEach(() => {
  vi.clearAllMocks();
  useAuth.mockReturnValue(auth);
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useFriendRequests", () => {
  it("loads and filters to pending incoming requests on mount", async () => {
    const socket = makeSocket();
    useLoginContext.mockReturnValue({ user: { username: "me" }, socket });
    getFriendships.mockResolvedValue([
      friendship("f1", "pending", "me", "alice"), // incoming pending -> keep
      friendship("f2", "pending", "bob", "me"), // outgoing pending -> drop
      friendship("f3", "accepted", "me", "carol"), // not pending -> drop
    ]);

    const { result } = renderHook(() => useFriendRequests());

    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(getFriendships).toHaveBeenCalledWith("me");
    expect(result.current.incomingRequests).toHaveLength(1);
    expect(result.current.incomingRequests[0].friendshipId).toBe("f1");

    // socket subscription wired up
    expect(socket.on).toHaveBeenCalledWith("friendRequestReceived", expect.any(Function));
  });

  it("does not fetch when there is no username", async () => {
    const socket = makeSocket();
    useLoginContext.mockReturnValue({ user: { username: "" }, socket });

    const { result } = renderHook(() => useFriendRequests());

    await waitFor(() => expect(true).toBe(true));
    expect(getFriendships).not.toHaveBeenCalled();
    // loading stays true since refresh returns early before finally
    expect(result.current.loading).toBe(true);
  });

  it("handles a fetch error and stops loading", async () => {
    const socket = makeSocket();
    useLoginContext.mockReturnValue({ user: { username: "me" }, socket });
    getFriendships.mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useFriendRequests());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.incomingRequests).toEqual([]);
    expect(errorSpy).toHaveBeenCalled();
  });

  it("re-fetches when a socket event addressed to me arrives", async () => {
    const socket = makeSocket();
    useLoginContext.mockReturnValue({ user: { username: "me" }, socket });
    getFriendships.mockResolvedValue([friendship("f1", "pending", "me")]);

    const { result } = renderHook(() => useFriendRequests());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getFriendships).toHaveBeenCalledTimes(1);

    getFriendships.mockResolvedValue([
      friendship("f1", "pending", "me"),
      friendship("f2", "pending", "me"),
    ]);

    await act(async () => {
      socket.emit("friendRequestReceived", friendship("f2", "pending", "me"));
    });

    await waitFor(() => expect(result.current.incomingRequests).toHaveLength(2));
    expect(getFriendships).toHaveBeenCalledTimes(2);
  });

  it("ignores a socket event addressed to someone else", async () => {
    const socket = makeSocket();
    useLoginContext.mockReturnValue({ user: { username: "me" }, socket });
    getFriendships.mockResolvedValue([]);

    const { result } = renderHook(() => useFriendRequests());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getFriendships).toHaveBeenCalledTimes(1);

    await act(async () => {
      socket.emit("friendRequestReceived", friendship("f9", "pending", "someoneElse"));
    });

    expect(getFriendships).toHaveBeenCalledTimes(1);
  });

  it("does not subscribe when there is no socket and cleans up on unmount", async () => {
    const socket = makeSocket();
    useLoginContext.mockReturnValueOnce({ user: { username: "me" }, socket: null });
    getFriendships.mockResolvedValue([]);

    const { unmount } = renderHook(() => useFriendRequests());
    await waitFor(() => expect(getFriendships).toHaveBeenCalled());
    expect(socket.on).not.toHaveBeenCalled();

    // Re-render path with a real socket to exercise cleanup
    useLoginContext.mockReturnValue({ user: { username: "me" }, socket });
    const { unmount: unmount2 } = renderHook(() => useFriendRequests());
    await waitFor(() =>
      expect(socket.on).toHaveBeenCalledWith("friendRequestReceived", expect.any(Function)),
    );
    unmount2();
    expect(socket.off).toHaveBeenCalledWith("friendRequestReceived", expect.any(Function));
    unmount();
  });

  it("accepts a request and removes it from the list", async () => {
    const socket = makeSocket();
    useLoginContext.mockReturnValue({ user: { username: "me" }, socket });
    getFriendships.mockResolvedValue([
      friendship("f1", "pending", "me"),
      friendship("f2", "pending", "me"),
    ]);
    respondToFriendRequest.mockResolvedValue({});

    const { result } = renderHook(() => useFriendRequests());
    await waitFor(() => expect(result.current.incomingRequests).toHaveLength(2));

    await act(async () => {
      await result.current.acceptFriendRequest("f1");
    });

    expect(respondToFriendRequest).toHaveBeenCalledWith(auth, "f1", "accepted");
    expect(result.current.incomingRequests.map((r) => r.friendshipId)).toEqual(["f2"]);
  });

  it("rejects a request and removes it from the list", async () => {
    const socket = makeSocket();
    useLoginContext.mockReturnValue({ user: { username: "me" }, socket });
    getFriendships.mockResolvedValue([friendship("f1", "pending", "me")]);
    respondToFriendRequest.mockResolvedValue({});

    const { result } = renderHook(() => useFriendRequests());
    await waitFor(() => expect(result.current.incomingRequests).toHaveLength(1));

    await act(async () => {
      await result.current.rejectFriendRequest("f1");
    });

    expect(respondToFriendRequest).toHaveBeenCalledWith(auth, "f1", "rejected");
    expect(result.current.incomingRequests).toEqual([]);
  });

  it("logs and keeps the list when accept fails", async () => {
    const socket = makeSocket();
    useLoginContext.mockReturnValue({ user: { username: "me" }, socket });
    getFriendships.mockResolvedValue([friendship("f1", "pending", "me")]);
    respondToFriendRequest.mockRejectedValue(new Error("nope"));

    const { result } = renderHook(() => useFriendRequests());
    await waitFor(() => expect(result.current.incomingRequests).toHaveLength(1));

    await act(async () => {
      await result.current.acceptFriendRequest("f1");
    });

    expect(errorSpy).toHaveBeenCalled();
    expect(result.current.incomingRequests).toHaveLength(1);
  });

  it("logs and keeps the list when reject fails", async () => {
    const socket = makeSocket();
    useLoginContext.mockReturnValue({ user: { username: "me" }, socket });
    getFriendships.mockResolvedValue([friendship("f1", "pending", "me")]);
    respondToFriendRequest.mockRejectedValue(new Error("nope"));

    const { result } = renderHook(() => useFriendRequests());
    await waitFor(() => expect(result.current.incomingRequests).toHaveLength(1));

    await act(async () => {
      await result.current.rejectFriendRequest("f1");
    });

    expect(errorSpy).toHaveBeenCalled();
    expect(result.current.incomingRequests).toHaveLength(1);
  });
});
