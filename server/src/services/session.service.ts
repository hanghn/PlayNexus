/**
 * Session lifecycle: minting, validating, and revoking login sessions.
 *
 * A session is represented to the client only as an opaque random token stored
 * in an HttpOnly cookie. The server keeps the SHA-256 hash of that token in the
 * `sessions` table (see `session.ts`); the raw token is never persisted, so a
 * database leak cannot be replayed as a valid cookie.
 */

import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
  deleteSessionByTokenHash,
  deleteSessionsByUserId,
  findSessionByTokenHash,
  insertSession,
  touchSession,
  type SessionRecord,
} from "../session.ts";
import { UserRepo } from "../repository.ts";
import type { UserWithId } from "../types.ts";

/** Name of the cookie that carries the session token. */
export const SESSION_COOKIE = "pn_session";

/** Lifetime of a persistent ("remember me") session. */
const REMEMBER_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/** Lifetime of a non-persistent session (survives refresh, not browser close). */
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 1 day

/** SHA-256 hex digest of a token. */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Mint a new session for a user and persist it.
 *
 * @param userId - the app user the session belongs to
 * @param remember - whether the session should be long-lived ("remember me")
 * @returns the raw token to place in the cookie, the matching `maxAgeMs`
 *   to use for a persistent cookie (or null for a browser-session cookie),
 *   and the absolute expiry.
 */
export async function createSession(
  userId: string,
  remember: boolean,
): Promise<{ token: string; maxAgeMs: number | null; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  const ttlMs = remember ? REMEMBER_TTL_MS : SESSION_TTL_MS;
  const expiresAt = new Date(now.getTime() + ttlMs);

  const record: SessionRecord = {
    sessionId: randomUUID(),
    userId,
    tokenHash: hashToken(token),
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    remember,
    revoked: false,
    lastSeen: now.toISOString(),
  };
  await insertSession(record);

  // A "remember me" session gets a persistent cookie; otherwise the cookie is
  // a session cookie (no Max-Age) so it clears when the browser closes, even
  // though the row itself remains valid until `expiresAt`.
  return { token, maxAgeMs: remember ? ttlMs : null, expiresAt };
}

/**
 * How stale `lastSeen` must be before a validation bothers to write it back.
 * `attachSession` validates on every request (and sockets on every event), so
 * touching the row each time would be a Supabase write per request — far too
 * much. We only refresh once the recorded `lastSeen` is older than this.
 */
const TOUCH_THROTTLE_MS = 60 * 1000; // 1 minute

/**
 * Resolve a raw session token to its owning user, or null if the token is
 * missing, unknown, revoked, or expired. Expired/revoked sessions are deleted
 * as a side effect. Refreshes `lastSeen` (throttled) on a successful validation.
 */
export async function validateSession(token: string | undefined): Promise<UserWithId | null> {
  if (!token) return null;

  const record = await findSessionByTokenHash(hashToken(token));
  if (!record) return null;

  if (record.revoked || new Date(record.expiresAt).getTime() <= Date.now()) {
    await deleteSessionByTokenHash(record.tokenHash);
    return null;
  }

  const user = await UserRepo.find(record.userId);
  if (!user) {
    // Session points at a user that no longer exists; clean it up.
    await deleteSessionByTokenHash(record.tokenHash);
    return null;
  }

  // Only write `lastSeen` back when it's actually stale, to avoid a Supabase
  // write on every single request/socket event.
  if (Date.now() - new Date(record.lastSeen).getTime() > TOUCH_THROTTLE_MS) {
    await touchSession(record.sessionId, new Date().toISOString());
  }
  return { userId: record.userId, username: user.username };
}

/** Revoke a single session (used on logout). No-op for unknown tokens. */
export async function revokeSession(token: string | undefined): Promise<void> {
  if (!token) return;
  await deleteSessionByTokenHash(hashToken(token));
}

/** Revoke every session for a user (used when opting out of cookies). */
export async function revokeAllSessionsForUser(userId: string): Promise<void> {
  await deleteSessionsByUserId(userId);
}

/**
 * Parse a single named cookie out of a raw `Cookie` header.
 *
 * We parse by hand to avoid pulling in `cookie-parser` for one cookie; setting
 * cookies still uses Express's built-in `res.cookie`/`res.clearCookie`.
 */
export function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return undefined;
}

/**
 * Resolve the logged-in user from a raw `Cookie` header, or null if there is no
 * valid session cookie. HTTP routes get this for free via `attachSession`
 * (`req.session`); socket handlers use this to honor the same cookie auth from
 * the handshake headers, so a cookie-restored client (no password in hand) can
 * still act over the socket.
 */
export async function sessionUserFromCookies(
  cookieHeader: string | undefined,
): Promise<UserWithId | null> {
  return validateSession(readCookie(cookieHeader, SESSION_COOKIE));
}
