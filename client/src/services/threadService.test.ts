// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./api.ts", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import { api } from "./api.ts";
import {
  addCommentToThread,
  createThread,
  deleteComment,
  threadInfo,
  threadList,
} from "./threadService.ts";

const mockedApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
};

const auth = { username: "alice", password: "pw" } as never;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("threadService", () => {
  describe("threadList", () => {
    it("returns the list of thread summaries", async () => {
      const summaries = [{ id: "1" }, { id: "2" }];
      mockedApi.get.mockResolvedValueOnce({ data: summaries });

      const result = await threadList();

      expect(mockedApi.get).toHaveBeenCalledWith("/api/thread/list");
      expect(result).toBe(summaries);
    });

    it("throws when the response is an error", async () => {
      mockedApi.get.mockResolvedValueOnce({ data: { error: "boom" } });
      await expect(threadList()).rejects.toThrow("boom");
    });
  });

  describe("threadInfo", () => {
    it("fetches an individual thread by id", async () => {
      const info = { id: "42", comments: [] };
      mockedApi.get.mockResolvedValueOnce({ data: info });

      const result = await threadInfo("42");

      expect(mockedApi.get).toHaveBeenCalledWith("/api/thread/42");
      expect(result).toBe(info);
    });

    it("throws when the response is an error", async () => {
      mockedApi.get.mockResolvedValueOnce({ data: { error: "not found" } });
      await expect(threadInfo("99")).rejects.toThrow("not found");
    });
  });

  describe("addCommentToThread", () => {
    it("posts a comment payload and returns the thread", async () => {
      const info = { id: "1", comments: ["c"] };
      mockedApi.post.mockResolvedValueOnce({ data: info });

      const result = await addCommentToThread(auth, "1", "hello");

      expect(mockedApi.post).toHaveBeenCalledWith("/api/thread/1/comment", {
        auth,
        payload: "hello",
      });
      expect(result).toBe(info);
    });

    it("throws when the response is an error", async () => {
      mockedApi.post.mockResolvedValueOnce({ data: { error: "denied" } });
      await expect(addCommentToThread(auth, "1", "x")).rejects.toThrow("denied");
    });
  });

  describe("deleteComment", () => {
    it("posts to the delete endpoint with auth", async () => {
      const info = { id: "1", comments: [] };
      mockedApi.post.mockResolvedValueOnce({ data: info });

      const result = await deleteComment(auth, "t1", "c1");

      expect(mockedApi.post).toHaveBeenCalledWith("/api/thread/t1/comment/c1/delete", {
        auth,
      });
      expect(result).toBe(info);
    });

    it("throws when the response is an error", async () => {
      mockedApi.post.mockResolvedValueOnce({ data: { error: "nope" } });
      await expect(deleteComment(auth, "t1", "c1")).rejects.toThrow("nope");
    });
  });

  describe("createThread", () => {
    it("posts a new thread payload and returns the thread", async () => {
      const info = { id: "new", comments: [] };
      const payload = { title: "t", body: "b" } as never;
      mockedApi.post.mockResolvedValueOnce({ data: info });

      const result = await createThread(auth, payload);

      expect(mockedApi.post).toHaveBeenCalledWith("/api/thread/create", {
        auth,
        payload,
      });
      expect(result).toBe(info);
    });

    it("throws when the response is an error", async () => {
      mockedApi.post.mockResolvedValueOnce({ data: { error: "bad" } });
      await expect(createThread(auth, {} as never)).rejects.toThrow("bad");
    });
  });
});
