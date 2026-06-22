import { useCallback, useEffect, useState } from "react";
import type { FriendshipInfo } from "@gamenite/shared";
import useAuth from "./useAuth.ts";
import useLoginContext from "./useLoginContext.ts";
import { getFriendships, respondToFriendRequest } from "../services/friendService.ts";

/**
 * Hook for the home-page friend-request box.
 *
 * Reads pending *incoming* requests from the Friendship API — the same data the
 * Friends page uses — so what you see here matches reality. It refreshes live
 * whenever the server pushes a `friendRequestReceived` event addressed to you.
 *
 * @returns incoming requests plus accept/reject actions and a loading flag
 */
export default function useFriendRequests() {
  const auth = useAuth();
  const { user, socket } = useLoginContext();
  const [incomingRequests, setIncomingRequests] = useState<FriendshipInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    if (!user.username) return;
    getFriendships(user.username)
      .then((all) =>
        setIncomingRequests(
          all.filter((f) => f.status === "pending" && f.to.username === user.username),
        ),
      )
      .catch((error) => {
        // eslint-disable-next-line no-console
        console.error("Failed to fetch friend requests:", error);
      })
      .finally(() => setLoading(false));
  }, [user.username]);

  // Load on mount / when the signed-in user changes.
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Live update: re-fetch when a request addressed to me arrives.
  useEffect(() => {
    if (!socket) return;
    const handleReceived = (friendship: FriendshipInfo) => {
      if (friendship.to.username === user.username) refresh();
    };
    socket.on("friendRequestReceived", handleReceived);
    return () => {
      socket.off("friendRequestReceived", handleReceived);
    };
  }, [socket, user.username, refresh]);

  const acceptFriendRequest = async (friendshipId: string) => {
    try {
      await respondToFriendRequest(auth, friendshipId, "accepted");
      setIncomingRequests((prev) => prev.filter((f) => f.friendshipId !== friendshipId));
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to accept friend request:", error);
    }
  };

  const rejectFriendRequest = async (friendshipId: string) => {
    try {
      await respondToFriendRequest(auth, friendshipId, "rejected");
      setIncomingRequests((prev) => prev.filter((f) => f.friendshipId !== friendshipId));
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to reject friend request:", error);
    }
  };

  return { incomingRequests, loading, acceptFriendRequest, rejectFriendRequest };
}
