import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { GameInvitationInfo, GameInviteDeclinedInfo } from "@gamenite/shared";
import useAuth from "./useAuth.ts";
import useLoginContext from "./useLoginContext.ts";
import { declineGameInvite, getMyInvitations } from "../services/gameService.ts";
import { announce } from "../lib/liveAnnounce.ts";

/**
 * Hook for the live game-invitation toasts.
 *
 * Listens for `gameInvitationReceived` events addressed to the signed-in user
 * and keeps them in a small queue. Accepting navigates to the game's lobby with
 * an `autoJoin` flag so the recipient is added as a player automatically.
 * Declining tells the server, which notifies the inviter so they learn the
 * invite was declined (`gameInviteDeclined`).
 *
 * @returns pending invitations, decline notices (for inviters), and actions
 */
export default function useGameInvites() {
  const { user, socket } = useLoginContext();
  const auth = useAuth();
  const navigate = useNavigate();
  const [invites, setInvites] = useState<GameInvitationInfo[]>([]);
  const [declines, setDeclines] = useState<GameInviteDeclinedInfo[]>([]);

  // On login/mount, pull any invites sent while this user was offline.
  useEffect(() => {
    if (!user.username) return;
    void getMyInvitations(user.username)
      .then((pending) =>
        setInvites((prev) => {
          const merged = [...prev];
          for (const inv of pending) {
            if (
              !merged.some((i) => i.gameId === inv.gameId && i.from.username === inv.from.username)
            )
              merged.push(inv);
          }
          return merged;
        }),
      )
      .catch(() => {
        /* offline-invite fetch is best-effort */
      });
  }, [user.username]);

  useEffect(() => {
    if (!socket) return;

    const handleReceived = (invite: GameInvitationInfo) => {
      if (invite.toUsername !== user.username) return;
      setInvites((prev) =>
        prev.some((i) => i.gameId === invite.gameId && i.from.username === invite.from.username)
          ? prev
          : [...prev, invite],
      );
      announce(`${invite.from.display} invited you to a game.`, true);
    };

    // The inviter learns a recipient declined their invitation. Broadcast to all;
    // only the inviter reacts, and never the decliner.
    const handleDeclined = (info: GameInviteDeclinedInfo) => {
      if (info.by.username === user.username) return; // never show the decliner
      if (info.inviterUsername !== user.username) return; // only the inviter
      setDeclines((prev) =>
        prev.some((d) => d.gameId === info.gameId && d.by.username === info.by.username)
          ? prev
          : [...prev, info],
      );
    };

    socket.on("gameInvitationReceived", handleReceived);
    socket.on("gameInviteDeclined", handleDeclined);
    return () => {
      socket.off("gameInvitationReceived", handleReceived);
      socket.off("gameInviteDeclined", handleDeclined);
    };
  }, [socket, user.username]);

  const dismiss = (gameId: string) => setInvites((prev) => prev.filter((i) => i.gameId !== gameId));

  const accept = async (invite: GameInvitationInfo) => {
    dismiss(invite.gameId);
    await navigate(`/game/${invite.gameId}`, { state: { autoJoin: true } });
  };

  const decline = async (invite: GameInvitationInfo) => {
    dismiss(invite.gameId);
    try {
      await declineGameInvite(auth, invite.gameId, invite.from.username);
    } catch {
      /* best-effort notification; the invite is already dismissed locally */
    }
  };

  const dismissDecline = (gameId: string, byUsername: string) =>
    setDeclines((prev) =>
      prev.filter((d) => !(d.gameId === gameId && d.by.username === byUsername)),
    );

  return { invites, declines, accept, decline, dismissDecline };
}
