// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the axios wrapper. `apiErrorMessage` mirrors the real implementation
// closely enough for the service's error-translation behavior: it prefers a
// thrown Error's message, otherwise returns the provided fallback.
vi.mock("./api.ts", () => ({
  api: {
    post: vi.fn(),
    get: vi.fn(),
  },
  apiErrorMessage: vi.fn((err: unknown, fallback = "Something went wrong") => {
    if (err instanceof Error && err.message) return err.message;
    return fallback;
  }),
}));

import {
  sendFriendRequest,
  respondToFriendRequest,
  removeFriend,
  getFriendships,
} from "./friendService.ts";
import { api } from "./api.ts";

const mockedApi = api as unknown as {
  post: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
};

const auth = { username: "alice", password: "pw" } as never;

const friendship = {
  _id: "f1",
  requester: "alice",
  recipient: "bob",
  status: "pending",
} as never;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("sendFriendRequest", () => {
  it("posts to the request endpoint and returns friendship data", async () => {
    mockedApi.post.mockResolvedValueOnce({ data: friendship });

    const result = await sendFriendRequest(auth, "bob");

    expect(result).toEqual(friendship);
    expect(mockedApi.post).toHaveBeenCalledWith("/api/friend/request", {
      auth,
      payload: { toUsername: "bob" },
    });
  });

  it("throws the server error message when the body carries { error }", async () => {
    mockedApi.post.mockResolvedValueOnce({ data: { error: "User not found" } });

    await expect(sendFriendRequest(auth, "ghost")).rejects.toThrow("User not found");
  });

  it("falls back to the default message when the call rejects without one", async () => {
    mockedApi.post.mockRejectedValueOnce({});

    await expect(sendFriendRequest(auth, "bob")).rejects.toThrow("User not found");
  });
});

describe("respondToFriendRequest", () => {
  it("posts the status update and returns the updated friendship", async () => {
    const accepted = { ...(friendship as object), status: "accepted" } as never;
    mockedApi.post.mockResolvedValueOnce({ data: accepted });

    const result = await respondToFriendRequest(auth, "f1", "accepted");

    expect(result).toEqual(accepted);
    expect(mockedApi.post).toHaveBeenCalledWith("/api/friend/f1", {
      auth,
      payload: { friendshipId: "f1", status: "accepted" },
    });
  });

  it("throws the server error message on an { error } body", async () => {
    mockedApi.post.mockResolvedValueOnce({ data: { error: "Already responded" } });

    await expect(respondToFriendRequest(auth, "f1", "rejected")).rejects.toThrow(
      "Already responded",
    );
  });

  it("uses the fallback message when the request rejects", async () => {
    mockedApi.post.mockRejectedValueOnce({});

    await expect(respondToFriendRequest(auth, "f1", "blocked")).rejects.toThrow(
      "Could not update friend request",
    );
  });
});

describe("removeFriend", () => {
  it("posts to the remove endpoint and returns the friendship", async () => {
    mockedApi.post.mockResolvedValueOnce({ data: friendship });

    const result = await removeFriend(auth, "f1");

    expect(result).toEqual(friendship);
    expect(mockedApi.post).toHaveBeenCalledWith("/api/friend/f1/remove", { auth });
  });

  it("throws the server error message on an { error } body", async () => {
    mockedApi.post.mockResolvedValueOnce({ data: { error: "Not friends" } });

    await expect(removeFriend(auth, "f1")).rejects.toThrow("Not friends");
  });

  it("uses the fallback message when the request rejects", async () => {
    mockedApi.post.mockRejectedValueOnce({});

    await expect(removeFriend(auth, "f1")).rejects.toThrow("Could not remove friend");
  });
});

describe("getFriendships", () => {
  it("gets the list endpoint with the username param and returns the array", async () => {
    const list = [friendship];
    mockedApi.get.mockResolvedValueOnce({ data: list });

    const result = await getFriendships("alice");

    expect(result).toEqual(list);
    expect(mockedApi.get).toHaveBeenCalledWith("/api/friend/list", {
      params: { username: "alice" },
    });
  });

  it("throws the server error message when the body carries { error }", async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { error: "Forbidden" } });

    await expect(getFriendships("alice")).rejects.toThrow("Forbidden");
  });
});
