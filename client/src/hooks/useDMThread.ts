import { useCallback, useEffect, useState } from "react";
import type { DMThreadInfo, DMNewMessagePayload } from "@gamenite/shared";
import useAuth from "./useAuth.ts";
import useLoginContext from "./useLoginContext.ts";
import { getDMThread } from "../services/dmService.ts";

/**
 * Hook that loads and manages a single DM thread.
 *
 * History is loaded once over REST, then the thread subscribes to its Socket.io
 * room so new messages arrive in real time. Sending also goes over the socket;
 * the server broadcasts the message back to everyone in the room, including
 * the sender, so the UI updates uniformly.
 *
 * - `thread`: the current thread state, or null while loading
 * - `error`: error message if the initial load failed
 * - `send(text)`: send a message over the socket
 * - `refresh()`: manually re-fetch the thread over REST
 */
export default function useDMThread(threadId: string) {
  const auth = useAuth();
  const { socket } = useLoginContext();
  const [thread, setThread] = useState<DMThreadInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    getDMThread(auth, threadId)
      .then(setThread)
      .catch((err) => setError(`${err}`));
  }, [auth, threadId]);

  useEffect(() => {
    // Initial history load over REST (also surfaces access/load errors)
    refresh();

    // ...then subscribe to the thread's room for live updates.
    const handleNewMessage = (payload: DMNewMessagePayload) => {
      if (payload.threadId !== threadId) return;
      setThread((old) => (old ? { ...old, messages: [...old.messages, payload.message] } : old));
    };

    const handleDeleted = (payload: { threadId: string; messageId: string }) => {
      if (payload.threadId !== threadId) return;
      setThread((old) =>
        old
          ? { ...old, messages: old.messages.filter((m) => m.messageId !== payload.messageId) }
          : old,
      );
    };

    socket.emit("dmJoin", { auth, payload: threadId });
    socket.on("dmNewMessage", handleNewMessage);
    socket.on("dmMessageDeleted", handleDeleted);
    return () => {
      socket.off("dmNewMessage", handleNewMessage);
      socket.off("dmMessageDeleted", handleDeleted);
      socket.emit("dmLeave", { auth, payload: threadId });
    };
  }, [socket, auth, threadId, refresh]);

  const send = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      socket.emit("dmSendMessage", { auth, payload: { threadId, text: text.trim() } });
    },
    [socket, auth, threadId],
  );

  const deleteMessage = useCallback(
    (messageId: string) => {
      socket.emit("dmDeleteMessage", { auth, payload: { threadId, messageId } });
    },
    [socket, auth, threadId],
  );

  return { thread, error, send, deleteMessage, refresh };
}
