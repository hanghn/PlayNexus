import { useContext } from "react";
import { LoginContext } from "../contexts/LoginContext.ts";
import type { GameSocket } from "../util/types.ts";
import type { SafeUserInfo } from "@gamenite/shared";

/**
 * Custom hook to access the LoginContext.
 * @throws if outside a LoginContext
 * @returns context information associated with a logged-in user:
 * - `socket`: the Socket.IO connection
 * - `user`: the logged-in user's information
 * - `pass`: legacy password value (may be undefined)
 * - `reset`: a callback
 * - `patchUser`: merge fields into the current user without a re-login
 */
export default function useLoginContext(): {
  socket: GameSocket;
  user: SafeUserInfo;
  pass?: string;
  reset: () => void;
  patchUser?: (updates: Partial<SafeUserInfo>) => void;
  onlineUsers: Set<string>;
} {
  const context = useContext(LoginContext);
  if (!context) {
    throw new Error("Login context is null.");
  }

  return context;
}
