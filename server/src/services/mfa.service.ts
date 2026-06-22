/**
 * Email-based two-factor authentication.
 *
 * Issuing a challenge mints a 6-digit code, emails it to the user, and stores
 * only its SHA-256 hash with a 10-minute expiry (COS 2.6). Verifying checks the
 * code in constant time, enforces expiry and a per-challenge attempt cap, and
 * single-uses the code. Enrollment data (the linked email and the enabled flag)
 * lives on the user's KV record.
 */

import { createHash, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import {
  deleteChallengesByUserId,
  findChallengeById,
  insertChallenge,
  updateChallenge,
  type OtpChallenge,
  type OtpPurpose,
} from "../otp.ts";
import { sendOtpEmail } from "../email.ts";
import { UserRepo } from "../repository.ts";
import type { MfaStatus } from "@gamenite/shared";

/** How long an issued code stays valid (COS 2.6). */
const OTP_TTL_MS = 10 * 60 * 1000;

/** Max wrong guesses before a challenge is locked (brute-force defense). */
const MAX_ATTEMPTS = 5;

/** SHA-256 hex digest of a code. */
function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

/** A zero-padded 6-digit numeric code. */
function generateCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/**
 * Mint a code, email it, persist the hashed challenge, and return its id.
 *
 * @param userId - the user the challenge is for
 * @param email - where to send the code
 * @param purpose - whether this gates a login or an enrollment
 * @param remember - the login's "remember me" choice (only meaningful for login)
 */
async function issueChallenge(
  userId: string,
  email: string,
  purpose: OtpPurpose,
  remember: boolean,
): Promise<string> {
  const code = generateCode();
  const now = new Date();
  const record: OtpChallenge = {
    challengeId: randomUUID(),
    userId,
    email,
    codeHash: hashCode(code),
    purpose,
    remember,
    attempts: 0,
    consumed: false,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + OTP_TTL_MS).toISOString(),
  };
  await insertChallenge(record);
  await sendOtpEmail(email, code, purpose);
  return record.challengeId;
}

/** Start a login 2FA challenge, emailing the user's linked address. */
export function startLoginChallenge(
  userId: string,
  email: string,
  remember: boolean,
): Promise<string> {
  return issueChallenge(userId, email, "login", remember);
}

/** Start an enrollment challenge, emailing the candidate address. */
export function startEnrollChallenge(userId: string, email: string): Promise<string> {
  return issueChallenge(userId, email, "enroll", false);
}

/** Why a verification failed, for mapping to an HTTP status/message. */
export type VerifyFailure = "invalid" | "expired" | "locked";

/** The outcome of verifying a code: the consumed challenge, or a failure reason. */
export type VerifyResult =
  | { ok: true; challenge: OtpChallenge }
  | { ok: false; reason: VerifyFailure };

/**
 * Verify a code against a challenge of the expected purpose. On success the
 * challenge is consumed (single-use). On a wrong code the attempt counter is
 * incremented and the challenge locks after `MAX_ATTEMPTS`.
 */
export async function verifyChallenge(
  challengeId: string,
  code: string,
  purpose: OtpPurpose,
): Promise<VerifyResult> {
  const challenge = await findChallengeById(challengeId);
  if (!challenge || challenge.purpose !== purpose || challenge.consumed) {
    return { ok: false, reason: "invalid" };
  }
  if (new Date(challenge.expiresAt).getTime() <= Date.now()) {
    return { ok: false, reason: "expired" };
  }
  if (challenge.attempts >= MAX_ATTEMPTS) {
    return { ok: false, reason: "locked" };
  }

  const expected = Buffer.from(challenge.codeHash, "hex");
  const actual = Buffer.from(hashCode(code), "hex");
  const matches = expected.length === actual.length && timingSafeEqual(expected, actual);
  if (!matches) {
    await updateChallenge(challengeId, { attempts: challenge.attempts + 1 });
    return { ok: false, reason: "invalid" };
  }

  await updateChallenge(challengeId, { consumed: true });
  return { ok: true, challenge };
}

/** Return a user's current 2FA configuration. */
export async function getMfaStatus(userId: string): Promise<MfaStatus> {
  const user = await UserRepo.get(userId);
  return { mfaEnabled: Boolean(user.mfaEnabled), email: user.email };
}

/** Turn on 2FA for a user, linking the confirmed email (COS 2.3). */
export async function enableMfa(userId: string, email: string): Promise<void> {
  const user = await UserRepo.get(userId);
  user.email = email;
  user.mfaEnabled = true;
  await UserRepo.set(userId, user);
}

/**
 * Turn off 2FA and delete the linked email and any pending challenges
 * (opt-out, COS 2.9).
 */
export async function disableMfa(userId: string): Promise<void> {
  const user = await UserRepo.get(userId);
  user.mfaEnabled = false;
  delete user.email;
  await UserRepo.set(userId, user);
  await deleteChallengesByUserId(userId);
}
