import { useCallback, useEffect, useState } from "react";
import type { FriendshipInfo } from "@gamenite/shared";
import useAuth from "./useAuth.ts";
import useLoginContext from "./useLoginContext.ts";
import {
  getFriendships,
  removeFriend,
  respondToFriendRequest,
  sendFriendRequest,
} from "../services/friendService.ts";

/**
 * Hook that loads and manages the current user's friendships.
 *
 * Returns:
 * - `friendships`: list of all FriendshipInfo records, or null while loading
 * - `error`: error message if the load failed
 * - `sendRequest(toUsername)`: send a friend request
 * - `respond(friendshipId, status)`: accept / reject / block a request
 * - `refresh()`: re-fetch the list
 */
export default function useFriends() {
  const { user } = useLoginContext();
  const auth = useAuth();
  const [friendships, setFriendships] = useState<FriendshipInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    getFriendships(user.username)
      .then(setFriendships)
      .catch((err) => setError(`${err}`));
  }, [user.username]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const sendRequest = async (toUsername: string) => {
    await sendFriendRequest(auth, toUsername);
    refresh();
  };

  const respond = async (friendshipId: string, status: "accepted" | "rejected" | "blocked") => {
    await respondToFriendRequest(auth, friendshipId, status);
    refresh();
  };

  const remove = async (friendshipId: string) => {
    await removeFriend(auth, friendshipId);
    refresh();
  };

  return { friendships, error, sendRequest, respond, remove, refresh };
}
