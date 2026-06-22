import { useCallback, useEffect, useRef, useState } from "react";
import type { FriendshipInfo } from "@gamenite/shared";
import useLoginContext from "./useLoginContext.ts";
import { announce } from "../lib/liveAnnounce.ts";

export interface SocialToast {
  id: string;
  kind: "dm" | "friend";
  text: string;
  /** Where clicking the toast takes you. */
  to: string;
}

const DISMISS_MS = 6000;

/**
 * Global toasts for incoming DMs and friend requests. Each toast is the visual
 * indicator; `announce()` gives the matching screen-reader (non-visual) cue.
 * Clicking a toast navigates to the relevant page. Toasts auto-dismiss, but the
 * timer pauses while the stack is hovered or keyboard-focused so a keyboard user
 * has time to act on one before it disappears.
 */
export default function useSocialToasts() {
  const { user, socket } = useLoginContext();
  const [toasts, setToasts] = useState<SocialToast[]>([]);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const toastsRef = useRef<SocialToast[]>([]);
  useEffect(() => {
    toastsRef.current = toasts;
  }, [toasts]);

  const dismiss = useCallback((id: string) => {
    clearTimeout(timers.current[id]);
    delete timers.current[id];
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const schedule = useCallback(
    (id: string) => {
      clearTimeout(timers.current[id]);
      timers.current[id] = setTimeout(() => dismiss(id), DISMISS_MS);
    },
    [dismiss],
  );

  /** Pause auto-dismiss (hover / focus enters the stack). */
  const pause = useCallback(() => {
    Object.values(timers.current).forEach(clearTimeout);
    timers.current = {};
  }, []);

  /** Resume auto-dismiss for any toast still showing (hover / focus leaves). */
  const resume = useCallback(() => {
    toastsRef.current.forEach((t) => {
      if (!timers.current[t.id]) schedule(t.id);
    });
  }, [schedule]);

  // Clear any pending timers on unmount.
  useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), []);

  useEffect(() => {
    if (!socket) return;

    const add = (toast: SocialToast) => {
      setToasts((prev) => (prev.some((t) => t.id === toast.id) ? prev : [...prev, toast]));
      schedule(toast.id);
    };

    // dmNotification is sent only to the recipient's personal room (never the
    // sender), so it always means a genuine incoming message.
    const onDm = (payload: { threadId: string; from: { username: string; display: string } }) => {
      // Never notify yourself about your own message (shared-cookie safety net).
      if (payload.from.username === user.username) return;
      announce(`New message from ${payload.from.display}.`);
      add({
        id: `dm-${payload.threadId}`,
        kind: "dm",
        text: `${payload.from.display} sent you a message`,
        to: `/messages/${payload.threadId}`,
      });
    };

    const onFriend = (friendship: FriendshipInfo) => {
      if (friendship.to.username !== user.username) return;
      announce(`New friend request from ${friendship.from.display}.`, true);
      add({
        id: `fr-${friendship.friendshipId}`,
        kind: "friend",
        text: `${friendship.from.display} sent you a friend request`,
        to: "/friends",
      });
    };

    socket.on("dmNotification", onDm);
    socket.on("friendRequestReceived", onFriend);
    return () => {
      socket.off("dmNotification", onDm);
      socket.off("friendRequestReceived", onFriend);
    };
  }, [socket, user.username, schedule]);

  return { toasts, dismiss, pause, resume };
}
