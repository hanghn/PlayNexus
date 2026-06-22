import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import useLoginContext from "../hooks/useLoginContext.ts";
import { UnreadContext } from "../contexts/UnreadContext.ts";

/**
 * Keeps per-thread unread DM counts based on the live `dmNotification` events,
 * so badges work wherever the user is. Opening a thread (or a new message in the
 * thread you're currently viewing) marks it read.
 */
export default function UnreadProvider({ children }: { children: ReactNode }) {
  const { socket, user } = useLoginContext();
  const location = useLocation();
  const activeThreadId = location.pathname.startsWith("/messages/")
    ? (location.pathname.split("/")[2] ?? null)
    : null;
  const [counts, setCounts] = useState<Record<string, number>>({});

  // Opening a thread clears its unread count.
  useEffect(() => {
    if (!activeThreadId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCounts((c) => (c[activeThreadId] ? { ...c, [activeThreadId]: 0 } : c));
  }, [activeThreadId]);

  useEffect(() => {
    if (!socket) return;
    const onDm = (payload: { threadId: string; from: { username: string; display: string } }) => {
      // Only skip your OWN messages (shared-cookie room cross-talk safety net).
      // Otherwise badge every received message, even on the Messages page, so
      // the unread cue always shows; it clears when the thread is opened/clicked.
      if (payload.from.username === user.username) return;
      setCounts((c) => ({ ...c, [payload.threadId]: (c[payload.threadId] ?? 0) + 1 }));
    };
    socket.on("dmNotification", onDm);
    return () => {
      socket.off("dmNotification", onDm);
    };
  }, [socket, user.username]);

  const value = useMemo(() => {
    const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
    return {
      counts,
      total,
      markThreadRead: (threadId: string) =>
        setCounts((c) => (c[threadId] ? { ...c, [threadId]: 0 } : c)),
    };
  }, [counts]);

  return <UnreadContext.Provider value={value}>{children}</UnreadContext.Provider>;
}
