import { api, apiErrorMessage } from "./api.ts";
import type {
  ErrorMsg,
  FriendshipInfo,
  FriendRequestPayload,
  FriendshipUpdatePayload,
  UserAuth,
} from "@gamenite/shared";

const FRIEND_API_URL = `/api/friend`;

/**
 * Send a friend request to another user. Throws an `Error` carrying the
 * server's message (e.g. "User not found") rather than a raw `AxiosError`.
 */
export const sendFriendRequest = async (
  auth: UserAuth,
  toUsername: string,
): Promise<FriendshipInfo> => {
  try {
    const payload: FriendRequestPayload = { toUsername };
    const res = await api.post<FriendshipInfo | ErrorMsg>(`${FRIEND_API_URL}/request`, {
      auth,
      payload,
    });
    if ("error" in res.data) throw new Error(res.data.error);
    return res.data;
  } catch (err) {
    throw new Error(apiErrorMessage(err, "User not found"));
  }
};

/**
 * Accept, reject, or block a pending friend request.
 */
export const respondToFriendRequest = async (
  auth: UserAuth,
  friendshipId: string,
  status: "accepted" | "rejected" | "blocked",
): Promise<FriendshipInfo> => {
  try {
    const payload: FriendshipUpdatePayload = { friendshipId, status };
    const res = await api.post<FriendshipInfo | ErrorMsg>(`${FRIEND_API_URL}/${friendshipId}`, {
      auth,
      payload,
    });
    if ("error" in res.data) throw new Error(res.data.error);
    return res.data;
  } catch (err) {
    throw new Error(apiErrorMessage(err, "Could not update friend request"));
  }
};

/**
 * Remove an existing friend (un-friend). Also disables DMs between the two
 * users, since direct messaging is gated on friendship.
 */
export const removeFriend = async (
  auth: UserAuth,
  friendshipId: string,
): Promise<FriendshipInfo> => {
  try {
    const res = await api.post<FriendshipInfo | ErrorMsg>(
      `${FRIEND_API_URL}/${friendshipId}/remove`,
      { auth },
    );
    if ("error" in res.data) throw new Error(res.data.error);
    return res.data;
  } catch (err) {
    throw new Error(apiErrorMessage(err, "Could not remove friend"));
  }
};

/**
 * Fetch all friendships (any status) involving a given user.
 */
export const getFriendships = async (username: string): Promise<FriendshipInfo[]> => {
  const res = await api.get<FriendshipInfo[] | ErrorMsg>(`${FRIEND_API_URL}/list`, {
    params: { username },
  });
  if ("error" in res.data) throw new Error(res.data.error);
  return res.data;
};
