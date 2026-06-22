import { describe, it, expect } from "vitest";
import { getUserByUsername } from "../../src/services/auth.service.ts";
import {
  createThread,
  getThreadById,
  getThreadSummaries,
  addCommentToThread,
  deleteCommentFromThread,
} from "../../src/services/thread.service.ts";
import type { UserWithId } from "../../src/types.ts";

async function getUser(name: string): Promise<UserWithId> {
  const u = await getUserByUsername(name);
  if (!u) throw new Error(`seed user ${name} missing`);
  return u;
}

describe("thread.service", () => {
  it("creates a thread and fetches it back", async () => {
    const u0 = await getUser("user0");
    const thread = await createThread(u0, { title: "Hello", text: "body" }, new Date());
    expect(thread.title).toBe("Hello");
    expect((await getThreadById(thread.threadId))?.threadId).toBe(thread.threadId);
  });

  it("getThreadById returns null for an unknown id", async () => {
    expect(await getThreadById("nope")).toBeNull();
  });

  it("lists thread summaries", async () => {
    expect((await getThreadSummaries()).length).toBeGreaterThanOrEqual(1);
  });

  it("addCommentToThread returns null for a missing thread", async () => {
    const u0 = await getUser("user0");
    expect(await addCommentToThread("missing", u0, "hi", new Date())).toBeNull();
  });

  it("addCommentToThread appends a comment", async () => {
    const u0 = await getUser("user0");
    const thread = await createThread(u0, { title: "T", text: "b" }, new Date());
    const updated = await addCommentToThread(thread.threadId, u0, "nice", new Date());
    expect(updated?.comments).toHaveLength(1);
  });

  describe("deleteCommentFromThread", () => {
    it("returns null for a missing thread", async () => {
      const u0 = await getUser("user0");
      expect(await deleteCommentFromThread("missing", u0, "c")).toBeNull();
    });

    it("errors when the comment doesn't exist", async () => {
      const u0 = await getUser("user0");
      const thread = await createThread(u0, { title: "T", text: "b" }, new Date());
      expect(await deleteCommentFromThread(thread.threadId, u0, "no-such")).toEqual({
        error: "Comment not found",
      });
    });

    it("won't delete another user's comment", async () => {
      const u0 = await getUser("user0");
      const u1 = await getUser("user1");
      const thread = await createThread(u0, { title: "T", text: "b" }, new Date());
      const withComment = await addCommentToThread(thread.threadId, u1, "u1 comment", new Date());
      const commentId = withComment!.comments[0].commentId;
      expect(await deleteCommentFromThread(thread.threadId, u0, commentId)).toEqual({
        error: "You can only delete your own comments",
      });
    });

    it("deletes the caller's own comment", async () => {
      const u0 = await getUser("user0");
      const thread = await createThread(u0, { title: "T", text: "b" }, new Date());
      const withComment = await addCommentToThread(thread.threadId, u0, "mine", new Date());
      const commentId = withComment!.comments[0].commentId;
      const res = await deleteCommentFromThread(thread.threadId, u0, commentId);
      expect(res && "comments" in res ? res.comments : ["x"]).toHaveLength(0);
    });
  });
});
