import { useContext } from "react";
import { UnreadContext, type UnreadContextValue } from "../contexts/UnreadContext.ts";

/**
 * Access per-thread unread DM counts + the total. Must be used within an
 * UnreadProvider (mounted in Layout).
 */
export default function useUnread(): UnreadContextValue {
  const ctx = useContext(UnreadContext);
  if (!ctx) throw new Error("useUnread must be used within an UnreadProvider");
  return ctx;
}
