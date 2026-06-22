import type { SafeUserInfo } from "@gamenite/shared";
import { createContext } from "react";
import type { Session } from "@supabase/supabase-js";
import type { GameSocket } from "../util/types.ts";

/**
 * The user information held as part of a login context
 *
 * - `user` - the current user (safe info)
 * - `pass` - legacy: kept for compatibility but optional; prefer session
 * - `reset` - a callback that logs out the user
 * - `patchUser` - merge fields into the current user in-place (e.g. after saving
 *   a new avatar or accent) so the UI updates without a full re-login
 * - `session` - optional Supabase session object
 * - `supabaseUserId` - optional Supabase auth user id
 */
export interface AuthContext {
  user: SafeUserInfo;
  pass?: string;
  reset: () => void;
  patchUser?: (updates: Partial<SafeUserInfo>) => void;
  session?: Session;
  supabaseUserId?: string;
}

/**
 * See useLoginContext()
 */
export const LoginContext = createContext<
  | (AuthContext & {
      socket: GameSocket;
      onlineUsers: Set<string>;
    })
  | null
>(null);
