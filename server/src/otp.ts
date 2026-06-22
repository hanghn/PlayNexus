/**
 * Storage layer for one-time-code (OTP) challenges used by email 2FA.
 *
 * Mirrors `session.ts`: challenges live in their own dedicated `otpChallenges`
 * table, accessed with the Supabase service-role key (RLS enabled, no
 * anon/authenticated policies). When `SUPABASE_URL` is absent (CI / local dev)
 * they fall back to an in-process Map so the flow works without a database.
 *
 * Only the SHA-256 hash of each code is stored; the plaintext code exists only
 * in the email that was sent.
 */

import { getSupabaseAdmin } from "./supabaseAdmin.ts";

/** The kind of action an OTP challenge gates. */
export type OtpPurpose = "login" | "enroll";

/**
 * A single OTP challenge row.
 *
 * - `challengeId`: random primary key, handed to the client to identify the code
 * - `userId`: the app user the challenge belongs to
 * - `email`: where the code was sent (the candidate email for `enroll`)
 * - `codeHash`: SHA-256 hash (hex) of the 6-digit code
 * - `purpose`: whether this gates a login or an email enrollment
 * - `remember`: the login's "remember me" choice, carried through to session creation
 * - `attempts`: number of incorrect guesses so far
 * - `consumed`: whether the code has already been successfully used
 * - `createdAt` / `expiresAt`: lifetime bounds (ISO strings)
 */
export interface OtpChallenge {
  challengeId: string;
  userId: string;
  email: string;
  codeHash: string;
  purpose: OtpPurpose;
  remember: boolean;
  attempts: number;
  consumed: boolean;
  createdAt: string;
  expiresAt: string;
}

/** Whether to persist challenges to Supabase (vs. the in-memory fallback). */
const useSupabase = (): boolean => Boolean(process.env.SUPABASE_URL);

const table = () => getSupabaseAdmin().from("otpChallenges");

/** In-process challenge store used when Supabase is not configured. */
const inMemoryChallenges = new Map<string, OtpChallenge>();

/** Fields of a challenge that may change after creation. */
type OtpChallengePatch = Partial<Pick<OtpChallenge, "attempts" | "consumed">>;

/** Persist a freshly created challenge. */
export async function insertChallenge(record: OtpChallenge): Promise<void> {
  if (!useSupabase()) {
    inMemoryChallenges.set(record.challengeId, { ...record });
    return;
  }
  const { error } = await table().insert(record);
  if (error) throw new Error(`Failed to insert OTP challenge: ${error.message}`);
}

/** Find a challenge by its id, or null if none exists. */
export async function findChallengeById(challengeId: string): Promise<OtpChallenge | null> {
  if (!useSupabase()) {
    const record = inMemoryChallenges.get(challengeId);
    return record ? { ...record } : null;
  }
  const result = await table().select("*").eq("challengeId", challengeId).maybeSingle();
  if (result.error) throw new Error(`Failed to find OTP challenge: ${result.error.message}`);
  return (result.data as OtpChallenge | null) ?? null;
}

/** Update the mutable fields (attempts / consumed) of a challenge. */
export async function updateChallenge(
  challengeId: string,
  patch: OtpChallengePatch,
): Promise<void> {
  if (!useSupabase()) {
    const record = inMemoryChallenges.get(challengeId);
    if (record) Object.assign(record, patch);
    return;
  }
  const { error } = await table().update(patch).eq("challengeId", challengeId);
  if (error) throw new Error(`Failed to update OTP challenge: ${error.message}`);
}

/** Remove every challenge belonging to a user (e.g. when disabling 2FA). */
export async function deleteChallengesByUserId(userId: string): Promise<void> {
  if (!useSupabase()) {
    for (const [id, record] of inMemoryChallenges) {
      if (record.userId === userId) inMemoryChallenges.delete(id);
    }
    return;
  }
  const { error } = await table().delete().eq("userId", userId);
  if (error) throw new Error(`Failed to delete OTP challenges for user: ${error.message}`);
}
