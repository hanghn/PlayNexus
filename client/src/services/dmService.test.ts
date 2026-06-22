// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./api.ts", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
  apiErrorMessage: vi.fn((err: unknown, fallback = "Something went wrong") => {
    if (err instanceof Error && err.message) return err.message;
    return fallback;
  }),
}));

import { api, apiErrorMessage } from "./api.ts";
import { openDMThread, sendDMMessage, getDMThread, getDMThreadList } from "./dmService.ts";
import type { UserAuth } from "@gamenite/shared";

const mockedApi = vi.mocked(api);
const mockedApiErrorMessage = vi.mocked(apiErrorMessage);

const auth: UserAuth = { username: "alice", password: "secret" };

const thread = { threadId: "t1", participants: ["alice", "bob"] } as never;

beforeEach(() => {
  vi.clearAllMocks();
  // Restore default passthrough behavior for apiErrorMessage after clearAllMocks.
  mockedApiErrorMessage.mockImplementation((err: unknown, fallback = "Something went wrong") => {
    if (err instanceof Error && err.message) return err.message;
    return fallback;
  });
});

describe("openDMThread", () => {
  it("posts to the open endpoint and returns thread data", async () => {
    mockedApi.post.mockResolvedValueOnce({ data: thread });

    const result = await openDMThread(auth, "bob");

    expect(result).toBe(thread);
    expect(mockedApi.post).toHaveBeenCalledWith("/api/dm/open", {
      auth,
      payload: { withUsername: "bob" },
    });
  });

  it("throws with the server error message when response carries an error", async () => {
    mockedApi.post.mockResolvedValueOnce({ data: { error: "User not found" } });

    await expect(openDMThread(auth, "ghost")).rejects.toThrow("User not found");
    expect(mockedApiErrorMessage).toHaveBeenCalled();
  });

  it("throws the fallback message when the request rejects without a message", async () => {
    mockedApi.post.mockRejectedValueOnce({});

    await expect(openDMThread(auth, "bob")).rejects.toThrow("User not found");
  });
});

describe("sendDMMessage", () => {
  it("posts the message to the thread endpoint and returns data", async () => {
    mockedApi.post.mockResolvedValueOnce({ data: thread });

    const result = await sendDMMessage(auth, "t1", "hello");

    expect(result).toBe(thread);
    expect(mockedApi.post).toHaveBeenCalledWith("/api/dm/t1/message", {
      auth,
      payload: { threadId: "t1", text: "hello" },
    });
  });

  it("throws with the server error message", async () => {
    mockedApi.post.mockResolvedValueOnce({ data: { error: "blocked" } });

    await expect(sendDMMessage(auth, "t1", "hi")).rejects.toThrow("blocked");
  });

  it("throws the fallback message when the request rejects without a message", async () => {
    mockedApi.post.mockRejectedValueOnce({});

    await expect(sendDMMessage(auth, "t1", "hi")).rejects.toThrow("Could not send message");
  });
});

describe("getDMThread", () => {
  it("gets the thread by id passing auth as params", async () => {
    mockedApi.get.mockResolvedValueOnce({ data: thread });

    const result = await getDMThread(auth, "t1");

    expect(result).toBe(thread);
    expect(mockedApi.get).toHaveBeenCalledWith("/api/dm/t1", {
      params: { username: "alice", password: "secret" },
    });
  });

  it("throws the raw server error (no wrapping)", async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { error: "Forbidden" } });

    await expect(getDMThread(auth, "t1")).rejects.toThrow("Forbidden");
  });
});

describe("getDMThreadList", () => {
  it("gets the list endpoint with the username param", async () => {
    const list = [thread];
    mockedApi.get.mockResolvedValueOnce({ data: list });

    const result = await getDMThreadList("alice");

    expect(result).toBe(list);
    expect(mockedApi.get).toHaveBeenCalledWith("/api/dm/list", {
      params: { username: "alice" },
    });
  });

  it("throws the raw server error (no wrapping)", async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { error: "Bad request" } });

    await expect(getDMThreadList("alice")).rejects.toThrow("Bad request");
  });
});
