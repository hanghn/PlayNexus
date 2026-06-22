import { z } from "zod";
import { zUserAuth } from "./auth.types.ts";

/**
 * Login request payload: a username/password pair plus an optional `remember`
 * flag. When `remember` is true, the issued session cookie is persistent
 * otherwise it is a session cookie that lasts only for the current browser session.
 */
export type LoginRequest = z.infer<typeof zLoginRequest>;
export const zLoginRequest = zUserAuth.extend({
  remember: z.boolean().optional(),
});

/**
 * The response returned by the logout endpoint.
 */
export interface LogoutResponse {
  ok: true;
}
