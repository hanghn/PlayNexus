import { type FriendshipInfo, type FriendshipStatus } from "@gamenite/shared";
import { getUserByUsername } from "./auth.service.ts";
import { populateSafeUserInfo } from "./user.service.ts";
import { FriendshipRepo } from "../repository.ts";
import type { UserWithId } from "../types.ts";

async function populateFriendshipInfo(
  friendshipId: string,
  record: Awaited<ReturnType<typeof FriendshipRepo.get>>,
): Promise<FriendshipInfo> {
  const [from, to] = await Promise.all([
    populateSafeUserInfo(record.fromUserId),
    populateSafeUserInfo(record.toUserId),
  ]);
  return {
    friendshipId,
    from,
    to,
    status: record.status,
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
  };
}

/**
 * Send a friend request from one user to another.
 *
 * @returns the new FriendshipInfo, or an error string if the request is invalid.
 */
export async function sendFriendRequest(
  from: UserWithId,
  toUsername: string,
): Promise<FriendshipInfo | { error: string }> {
  if (from.username === toUsername) {
    return { error: "Cannot send a friend request to yourself" };
  }

  const toUser = await getUserByUsername(toUsername);
  if (!toUser) return { error: "User not found" };

  const now = new Date().toISOString();
  const existing = await getFriendshipBetween(from.userId, toUser.userId);
  if (existing) {
    if (existing.status === "accepted") return { error: "You are already friends" };
    if (existing.status === "pending") return { error: "A friend request is already pending" };
    if (existing.status === "blocked") return { error: "Unable to send a friend request" };
    // A previously rejected/removed friendship can be re-opened as a fresh
    // pending request from whoever is asking now.
    const reopened = {
      fromUserId: from.userId,
      toUserId: toUser.userId,
      status: "pending" as FriendshipStatus,
      createdAt: now,
      updatedAt: now,
    };
    await FriendshipRepo.set(existing.friendshipId, reopened);
    return populateFriendshipInfo(existing.friendshipId, reopened);
  }

  const id = await FriendshipRepo.add({
    fromUserId: from.userId,
    toUserId: toUser.userId,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  });

  return populateFriendshipInfo(id, await FriendshipRepo.get(id));
}

/**
 * Update the status of a friendship (accept / reject / block).
 * Only the recipient (toUserId) may change the status.
 *
 * @returns the updated FriendshipInfo, or an error string.
 */
export async function updateFriendship(
  friendshipId: string,
  actor: UserWithId,
  newStatus: "accepted" | "rejected" | "blocked",
): Promise<FriendshipInfo | { error: string }> {
  const record = await FriendshipRepo.find(friendshipId);
  if (!record) return { error: "Friendship not found" };
  if (record.toUserId !== actor.userId) return { error: "Only the recipient can respond" };
  if (record.status !== "pending") return { error: "Request is no longer pending" };

  const updated = {
    ...record,
    status: newStatus as FriendshipStatus,
    updatedAt: new Date().toISOString(),
  };
  await FriendshipRepo.set(friendshipId, updated);
  return populateFriendshipInfo(friendshipId, updated);
}

/**
 * Return all friendships that involve a given user (as sender or recipient).
 */
export async function getFriendships(userId: string): Promise<FriendshipInfo[]> {
  const all = await FriendshipRepo.entries();
  const mine = all.filter(({ value }) => value.fromUserId === userId || value.toUserId === userId);
  return Promise.all(mine.map(({ key, value }) => populateFriendshipInfo(key, value)));
}

/**
 * Find any existing friendship record between two users, regardless of direction.
 */
async function getFriendshipBetween(
  userAId: string,
  userBId: string,
): Promise<FriendshipInfo | null> {
  const all = await FriendshipRepo.entries();
  const match = all.find(
    ({ value }) =>
      (value.fromUserId === userAId && value.toUserId === userBId) ||
      (value.fromUserId === userBId && value.toUserId === userAId),
  );
  if (!match) return null;
  return populateFriendshipInfo(match.key, match.value);
}

/** Whether two users are currently accepted friends (used to gate DMs). */
export async function areFriends(userAId: string, userBId: string): Promise<boolean> {
  const between = await getFriendshipBetween(userAId, userBId);
  return between?.status === "accepted";
}

/**
 * Remove a friendship ("un-friend"). Either participant may remove it; the
 * record is marked "rejected" so it drops out of friend lists and (because DMs
 * are gated on friendship) disables direct messaging between the two users.
 */
export async function removeFriendship(
  friendshipId: string,
  actor: UserWithId,
): Promise<FriendshipInfo | { error: string }> {
  const record = await FriendshipRepo.find(friendshipId);
  if (!record) return { error: "Friendship not found" };
  if (record.fromUserId !== actor.userId && record.toUserId !== actor.userId) {
    return { error: "Not your friendship" };
  }
  const updated = {
    ...record,
    status: "rejected" as FriendshipStatus,
    updatedAt: new Date().toISOString(),
  };
  await FriendshipRepo.set(friendshipId, updated);
  return populateFriendshipInfo(friendshipId, updated);
}
