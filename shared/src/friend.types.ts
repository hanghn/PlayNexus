import { z } from "zod";
import { type SafeUserInfo } from "./user.types.ts";

/**
 * The lifecycle states of a friend request.
 * - pending:  request sent, not yet accepted
 * - accepted: both users are friends
 * - rejected: recipient declined the request
 * - blocked:  recipient has blocked the sender
 */
export type FriendshipStatus = z.infer<typeof zFriendshipStatus>;
export const zFriendshipStatus = z.union([
  z.literal("pending"),
  z.literal("accepted"),
  z.literal("rejected"),
  z.literal("blocked"),
]);

/**
 * A friendship record as exposed to the client.
 * - `friendshipId`: database key
 * - `from`: user who sent the request
 * - `to`: user who received the request
 * - `status`: current lifecycle state
 * - `createdAt`: when the request was sent
 * - `updatedAt`: when the status last changed
 */
export interface FriendshipInfo {
  friendshipId: string;
  from: SafeUserInfo;
  to: SafeUserInfo;
  status: FriendshipStatus;
  createdAt: Date;
  updatedAt: Date;
}

/*** TYPES USED IN THE FRIENDS API ***/

/**
 * Payload to send a friend request.
 */
export type FriendRequestPayload = z.infer<typeof zFriendRequestPayload>;
export const zFriendRequestPayload = z.object({
  toUsername: z.string(),
});

/**
 * Payload to respond to or update a friendship (accept / reject / block).
 */
export type FriendshipUpdatePayload = z.infer<typeof zFriendshipUpdatePayload>;
export const zFriendshipUpdatePayload = z.object({
  friendshipId: z.string(),
  status: z.union([z.literal("accepted"), z.literal("rejected"), z.literal("blocked")]),
});
