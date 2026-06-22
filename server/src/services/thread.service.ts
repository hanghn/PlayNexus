import { type CreateThreadMessage, type ThreadInfo, type ThreadSummary } from "@gamenite/shared";
import { populateSafeUserInfo } from "./user.service.ts";
import { createComment, populateCommentInfo } from "./comment.service.ts";
import { type UserWithId } from "../types.ts";
import { CommentRepo, ThreadRepo } from "../repository.ts";

/**
 * Expand a stored thread
 *
 * @param threadId - Valid thread id
 * @returns the expanded thread info object
 */
async function populateThreadInfo(threadId: string): Promise<ThreadInfo> {
  const thread = await ThreadRepo.get(threadId);
  return {
    threadId,
    title: thread.title,
    text: thread.text,
    createdBy: await populateSafeUserInfo(thread.createdBy),
    createdAt: new Date(thread.createdAt),
    comments: await Promise.all(thread.comments.map(populateCommentInfo)),
  };
}

/**
 * Expand just the summary information for a stored thread
 *
 * @param threadId - Valid thread id
 * @returns the expanded thread info object
 */
async function populateThreadSummary(threadId: string) {
  const thread = await ThreadRepo.get(threadId);
  return {
    threadId,
    title: thread.title,
    createdBy: await populateSafeUserInfo(thread.createdBy),
    createdAt: new Date(thread.createdAt),
    comments: thread.comments.length,
  };
}

/**
 * Create and store a new thread
 *
 * @param user - The thread poster
 * @param contents - Title and text of the thread
 * @param createdAt - Creation time for this thread
 * @returns the new thread's info object
 */
export async function createThread(
  user: UserWithId,
  { title, text }: CreateThreadMessage,
  createdAt: Date,
): Promise<ThreadInfo> {
  const id = await ThreadRepo.add({
    title,
    text,
    createdAt: createdAt.toISOString(),
    createdBy: user.userId,
    comments: [],
  });
  return populateThreadInfo(id);
}

/**
 * Retrieves a single thread from the database
 *
 * @param possibleThreadId - Ostensible thread ID
 * @returns the thread, or null if no thread with that ID exists
 */
export async function getThreadById(possibleThreadId: string): Promise<ThreadInfo | null> {
  const thread = await ThreadRepo.find(possibleThreadId);
  if (!thread) return null;
  return populateThreadInfo(possibleThreadId);
}

/**
 * Get a list of all threads
 *
 * @returns a list of thread summaries, ordered reverse chronologically by creation date
 */
export async function getThreadSummaries(): Promise<ThreadSummary[]> {
  const keys = await ThreadRepo.getAllKeys();
  const unsorted = await Promise.all(keys.map(populateThreadSummary));

  return unsorted.toSorted(
    (thread1, thread2) => thread2.createdAt.getTime() - thread1.createdAt.getTime(),
  );
}

/**
 * Add a comment id to a thread
 * @param possibleThreadId - Ostensible thread ID
 * @param user - Commenting user
 * @param text - Contents of the thread
 * @param createdAt - Creation time for thread
 * @returns the updated thread with comment attached, or null if the thread does not exist
 */
export async function addCommentToThread(
  possibleThreadId: string,
  user: UserWithId,
  text: string,
  createdAt: Date,
): Promise<ThreadInfo | null> {
  const oldThread = await ThreadRepo.find(possibleThreadId);
  if (!oldThread) return null;
  const threadId = possibleThreadId; // We know the thread ID is valid at this point
  const comment = await createComment(user, text, createdAt);
  const newThread = { ...oldThread, comments: [...oldThread.comments, comment.commentId] };
  await ThreadRepo.set(possibleThreadId, newThread);
  return populateThreadInfo(threadId);
}

/**
 * Delete one of the caller's own comments from a thread (unlinks it). Returns
 * the updated thread, null if the thread is missing, or an error if it isn't
 * the caller's comment.
 */
export async function deleteCommentFromThread(
  threadId: string,
  user: UserWithId,
  commentId: string,
): Promise<ThreadInfo | null | { error: string }> {
  const oldThread = await ThreadRepo.find(threadId);
  if (!oldThread) return null;

  const comment = await CommentRepo.find(commentId);
  if (!comment) return { error: "Comment not found" };
  if (comment.createdBy !== user.userId) {
    return { error: "You can only delete your own comments" };
  }

  const newThread = {
    ...oldThread,
    comments: oldThread.comments.filter((id) => id !== commentId),
  };
  await ThreadRepo.set(threadId, newThread);
  return populateThreadInfo(threadId);
}
