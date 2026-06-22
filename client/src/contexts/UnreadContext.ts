import { createContext } from "react";

/**
 * Tracks unread DM counts per thread (and the total), so the Messages inbox can
 * badge each conversation and the sidebar can show the overall count.
 */
export interface UnreadContextValue {
  /** unread count keyed by threadId */
  counts: Record<string, number>;
  /** sum of all unread counts */
  total: number;
  /** clear a thread's unread count (e.g. when it's opened) */
  markThreadRead: (threadId: string) => void;
}

export const UnreadContext = createContext<UnreadContextValue | null>(null);
