import { type DMThreadInfo } from "@gamenite/shared";
import { getUserByUsername } from "./auth.service.ts";
import { populateSafeUserInfo } from "./user.service.ts";
import { createMessage } from "./message.service.ts";
import { areFriends } from "./friend.service.ts";
import { DMThreadRepo, MessageRepo } from "../repository.ts";
import type { DMThreadRecord } from "../models.ts";
import type { UserWithId } from "../types.ts";

async function populateDMThreadInfo(
  threadId: string,
  record: DMThreadRecord,
): Promise<DMThreadInfo> {
  const [p0, p1] = await Promise.all([
    populateSafeUserInfo(record.participants[0]),
    populateSafeUserInfo(record.participants[1]),
  ]);
  const { getMessagesById } = await import("./message.service.ts");
  return {
    threadId,
    participants: [p0, p1],
    messages: await getMessagesById(record.messages),
    createdAt: new Date(record.createdAt),
  };
}

/**
 * Find an existing DM thread between two users, or create one if none exists.
 * Returns an error string if the target user doesn't exist or is the requester.
 */
export async function openDMThread(
  from: UserWithId,
  toUsername: string,
): Promise<DMThreadInfo | { error: string }> {
  if (from.username === toUsername) {
    return { error: "Cannot open a DM thread with yourself" };
  }

  const toUser = await getUserByUsername(toUsername);
  if (!toUser) return { error: "User not found" };

  // Direct messaging is for friends only — removing a friend disables it.
  if (!(await areFriends(from.userId, toUser.userId))) {
    return { error: "You can only message friends" };
  }

  // Return existing thread if one already exists
  const existing = await findThreadBetween(from.userId, toUser.userId);
  if (existing) return existing;

  const now = new Date().toISOString();
  const id = await DMThreadRepo.add({
    participants: [from.userId, toUser.userId],
    messages: [],
    createdAt: now,
  });
  return populateDMThreadInfo(id, await DMThreadRepo.get(id));
}

/**
 * Retrieve a single DM thread by ID.
 * Returns null if the thread doesn't exist or the user is not a participant.
 */
export async function getDMThread(
  threadId: string,
  user: UserWithId,
): Promise<DMThreadInfo | null> {
  const record = await DMThreadRepo.find(threadId);
  if (!record) return null;
  if (!record.participants.includes(user.userId)) return null;
  return populateDMThreadInfo(threadId, record);
}

/**
 * Send a message inside a DM thread.
 * Returns an error string if the thread doesn't exist or the sender is not a participant.
 */
export async function sendDMMessage(
  threadId: string,
  user: UserWithId,
  text: string,
): Promise<DMThreadInfo | { error: string }> {
  const record = await DMThreadRepo.find(threadId);
  if (!record) return { error: "Thread not found" };
  if (!record.participants.includes(user.userId)) return { error: "Not a participant" };

  // Block messaging once the two are no longer friends.
  const otherId = record.participants.find((id) => id !== user.userId);
  if (otherId && !(await areFriends(user.userId, otherId))) {
    return { error: "You can only message friends" };
  }

  const message = await createMessage(user, text, new Date());
  const updated: DMThreadRecord = { ...record, messages: [...record.messages, message.messageId] };
  await DMThreadRepo.set(threadId, updated);
  return populateDMThreadInfo(threadId, updated);
}

/**
 * Delete one of the caller's own messages from a DM thread (unlinks it from the
 * thread). Returns the updated thread, or an error if it isn't theirs.
 */
export async function deleteDMMessage(
  threadId: string,
  user: UserWithId,
  messageId: string,
): Promise<DMThreadInfo | { error: string }> {
  const record = await DMThreadRepo.find(threadId);
  if (!record) return { error: "Thread not found" };
  if (!record.participants.includes(user.userId)) return { error: "Not a participant" };

  const message = await MessageRepo.find(messageId);
  if (!message) return { error: "Message not found" };
  if (message.createdBy !== user.userId) {
    return { error: "You can only delete your own messages" };
  }

  const updated: DMThreadRecord = {
    ...record,
    messages: record.messages.filter((id) => id !== messageId),
  };
  await DMThreadRepo.set(threadId, updated);
  return populateDMThreadInfo(threadId, updated);
}

/**
 * Return the user's DM threads — but only with people they're still friends
 * with, so removing a friend also removes the conversation from Messages (the
 * history reappears if they become friends again).
 */
export async function getDMThreadsForUser(userId: string): Promise<DMThreadInfo[]> {
  const all = await DMThreadRepo.entries();
  const mine = all.filter(({ value }) => value.participants.includes(userId));
  const withFriends = await Promise.all(
    mine.map(async ({ key, value }) => {
      const otherId = value.participants.find((id) => id !== userId);
      if (otherId && !(await areFriends(userId, otherId))) return null;
      return populateDMThreadInfo(key, value);
    }),
  );
  return withFriends.filter((t): t is DMThreadInfo => t !== null);
}

async function findThreadBetween(userAId: string, userBId: string): Promise<DMThreadInfo | null> {
  const all = await DMThreadRepo.entries();
  const match = all.find(
    ({ value }) => value.participants.includes(userAId) && value.participants.includes(userBId),
  );
  if (!match) return null;
  return populateDMThreadInfo(match.key, match.value);
}
