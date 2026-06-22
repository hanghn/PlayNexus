import { z } from "zod";
import type { SafeUserInfo } from "./user.types.ts";

/**
 * Request body for starting 2FA enrollment: the email address to link and have
 * a confirmation code sent to.
 */
export type MfaEnrollRequest = z.infer<typeof zMfaEnrollRequest>;
export const zMfaEnrollRequest = z.object({
  email: z.email(),
});

/**
 * Request body for verifying any one-time code (login or enrollment): the
 * challenge id returned when the code was issued, plus the code the user typed.
 */
export type OtpVerifyRequest = z.infer<typeof zOtpVerifyRequest>;
export const zOtpVerifyRequest = z.object({
  challengeId: z.string(),
  code: z.string(),
});

/**
 * Returned by `POST /login` when the account has 2FA enabled: a code has been
 * emailed and the client must verify it via `POST /login/verify`. No session
 * cookie is issued until the code is verified.
 */
export interface MfaChallenge {
  mfaRequired: true;
  challengeId: string;
}

/** The result of a login attempt: either the logged-in user or a 2FA challenge. */
export type LoginResult = SafeUserInfo | MfaChallenge;

/** Returned when an enrollment code has been issued. */
export interface MfaEnrollStart {
  challengeId: string;
}

/** A user's current 2FA configuration. */
export interface MfaStatus {
  mfaEnabled: boolean;
  /** The linked email, present only once 2FA is enabled. */
  email?: string;
}

/**
 * A user's full security configuration: their 2FA status plus whether their
 * sessions are persistent ("remember me" / cookies).
 */
export interface SecurityStatus extends MfaStatus {
  rememberMe: boolean;
}

/** Request body for setting the persistent-session ("remember me") preference. */
export type RememberRequest = z.infer<typeof zRememberRequest>;
export const zRememberRequest = z.object({
  remember: z.boolean(),
});
