import { useEffect, useState } from "react";
import type { DMThreadInfo } from "@gamenite/shared";
import useLoginContext from "./useLoginContext.ts";
import { getDMThreadList } from "../services/dmService.ts";

/**
 * Hook that loads the current user's DM thread list.
 * Returns the list, a loading flag, and an error message if applicable.
 */
export default function useDMList(): { threads: DMThreadInfo[] | null; error: string | null } {
  const { user, socket } = useLoginContext();
  const [threads, setThreads] = useState<DMThreadInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      getDMThreadList(user.username)
        .then((list) => {
          if (!cancelled) setThreads(list);
        })
        .catch((err) => {
          if (!cancelled) setError(`${err}`);
        });
    };
    load();

    // Refresh whenever a DM arrives so messages from brand-new senders (threads
    // that weren't in the initial fetch) show up in the inbox right away.
    if (!socket) return () => undefined;
    socket.on("dmNotification", load);
    return () => {
      cancelled = true;
      socket.off("dmNotification", load);
    };
  }, [user.username, socket]);

  return { threads, error };
}
