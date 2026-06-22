/**
 * Storage layer for login sessions ("cookies").
 *
 * Sessions live in their own dedicated `sessions` table (rather than the generic
 * `playnexus_kv` store) so they can be queried, expired, and revoked
 * independently. Backend selection mirrors `keyv.ts`: when `SUPABASE_URL` is set
 * (production) sessions persist to Supabase, so they survive restarts and are
 * shared across instances; when it is absent (CI / local dev without
 * credentials) they fall back to an in-process Map so login still works without
 * a database.
 *
 * The Supabase table is accessed with the service-role key. Row-level security
 * is enabled on it with no anon/authenticated policies, so only the server
 * (service role) can read or write session rows. Sessions are looked up by the
 * SHA-256 hash of the opaque token held in the user's cookie; the raw token is
 * never stored.
 */

import { getSupabaseAdmin } from "./supabaseAdmin.ts";

/**
 * A single persisted session row.
 *
 * - `sessionId`: random primary key for the row
 * - `userId`: the app user this session authenticates
 * - `tokenHash`: SHA-256 hash (hex) of the opaque cookie token
 * - `createdAt`: when the session was minted (ISO string)
 * - `expiresAt`: when the session stops being valid (ISO string)
 * - `remember`: whether this was a "remember me" (persistent) session
 * - `revoked`: whether the session has been explicitly invalidated
 * - `lastSeen`: when the session was last used (ISO string)
 */
export interface SessionRecord {
  sessionId: string;
  userId: string;
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
  remember: boolean;
  revoked: boolean;
  lastSeen: string;
}

/**
 * Whether to persist sessions to Supabase. When `SUPABASE_URL` is absent (CI and
 * local dev without credentials) we use the in-memory store instead, matching
 * how `keyv.ts` / `server.ts` choose their backend.
 */
const useSupabase = (): boolean => Boolean(process.env.SUPABASE_URL);

const table = () => getSupabaseAdmin().from("sessions");

/** In-process session store used when Supabase is not configured, keyed by tokenHash. */
const inMemorySessions = new Map<string, SessionRecord>();

/** Persist a freshly minted session. */
export async function insertSession(record: SessionRecord): Promise<void> {
  if (!useSupabase()) {
    inMemorySessions.set(record.tokenHash, { ...record });
    return;
  }
  const { error } = await table().insert(record);
  if (error) throw new Error(`Failed to insert session: ${error.message}`);
}

/** Find a session by its token hash, or null if none exists. */
export async function findSessionByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
  if (!useSupabase()) {
    const record = inMemorySessions.get(tokenHash);
    return record ? { ...record } : null;
  }
  const result = await table().select("*").eq("tokenHash", tokenHash).maybeSingle();
  if (result.error) throw new Error(`Failed to find session: ${result.error.message}`);
  return (result.data as SessionRecord | null) ?? null;
}

/** Update the `lastSeen` timestamp for a session. */
export async function touchSession(sessionId: string, lastSeen: string): Promise<void> {
  if (!useSupabase()) {
    for (const record of inMemorySessions.values()) {
      if (record.sessionId === sessionId) record.lastSeen = lastSeen;
    }
    return;
  }
  const { error } = await table().update({ lastSeen }).eq("sessionId", sessionId);
  if (error) throw new Error(`Failed to update session: ${error.message}`);
}

/** Permanently remove the session with the given token hash. */
export async function deleteSessionByTokenHash(tokenHash: string): Promise<void> {
  if (!useSupabase()) {
    inMemorySessions.delete(tokenHash);
    return;
  }
  const { error } = await table().delete().eq("tokenHash", tokenHash);
  if (error) throw new Error(`Failed to delete session: ${error.message}`);
}

/** Permanently remove every session belonging to a user (opt-out). */
export async function deleteSessionsByUserId(userId: string): Promise<void> {
  if (!useSupabase()) {
    for (const [hash, record] of inMemorySessions) {
      if (record.userId === userId) inMemorySessions.delete(hash);
    }
    return;
  }
  const { error } = await table().delete().eq("userId", userId);
  if (error) throw new Error(`Failed to delete sessions for user: ${error.message}`);
}
