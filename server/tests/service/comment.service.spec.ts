import { describe, it, expect } from "vitest";
import { getUserByUsername } from "../../src/services/auth.service.ts";
import { createComment, populateCommentInfo } from "../../src/services/comment.service.ts";
import { CommentRepo } from "../../src/repository.ts";

describe("comment.service", () => {
  it("creates a comment and populates its info", async () => {
    const u0 = (await getUserByUsername("user0"))!;
    const comment = await createComment(u0, "hello", new Date());
    expect(comment.text).toBe("hello");
    expect(comment.createdBy.username).toBe("user0");
    expect(comment.editedAt).toBeUndefined();

    const fetched = await populateCommentInfo(comment.commentId);
    expect(fetched.commentId).toBe(comment.commentId);
  });

  it("surfaces editedAt once a comment has been edited", async () => {
    const u0 = (await getUserByUsername("user0"))!;
    const comment = await createComment(u0, "v1", new Date());
    const record = await CommentRepo.get(comment.commentId);
    await CommentRepo.set(comment.commentId, { ...record, editedAt: new Date().toISOString() });
    expect((await populateCommentInfo(comment.commentId)).editedAt).toBeInstanceOf(Date);
  });
});
