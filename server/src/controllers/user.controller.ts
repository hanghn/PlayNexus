import {
  type LoginResult,
  type LogoutResponse,
  type MfaEnrollStart,
  type MfaStatus,
  type SafeUserInfo,
  type SecurityStatus,
  withAuth,
  zLoginRequest,
  zMfaEnrollRequest,
  zOtpVerifyRequest,
  zRememberRequest,
  zUserAuth,
  zUserUpdateRequest,
} from "@gamenite/shared";
import {
  createUser,
  getSecurityStatus,
  getUsersByUsername,
  populateSafeUserInfo,
  setUserRememberMe,
  updateUser,
} from "../services/user.service.ts";
import { type RestAPI } from "../types.ts";
import { z } from "zod";
import { checkAuth, getUserByUsername } from "../services/auth.service.ts";
import {
  SESSION_COOKIE,
  createSession,
  readCookie,
  revokeAllSessionsForUser,
  revokeSession,
} from "../services/session.service.ts";
import {
  type VerifyFailure,
  disableMfa,
  enableMfa,
  getMfaStatus,
  startEnrollChallenge,
  startLoginChallenge,
  verifyChallenge,
} from "../services/mfa.service.ts";
import type { Response } from "express";

/**
 * Set the session cookie on a response. The cookie is HttpOnly (unreadable by
 * JS), SameSite=Lax, and Secure in production. A persistent ("remember me")
 * session gets a Max-Age; otherwise it is a browser-session cookie.
 */
function setSessionCookie(res: Response, token: string, maxAgeMs: number | null): void {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.MODE === "production",
    path: "/",
    ...(maxAgeMs !== null ? { maxAge: maxAgeMs } : {}),
  });
}

/** Clear the session cookie (matching the attributes used to set it). */
function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.MODE === "production",
    path: "/",
  });
}

/**
 * Handles user login by validating credentials.
 * @param req The request containing username and password in the body.
 * @param res The response, either returning the user or an error.
 */
export const postLogin: RestAPI<LoginResult> = async (req, res) => {
  const login = zLoginRequest.safeParse(req.body);
  if (!login.success) {
    res.status(400).send({ error: "Poorly-formed request" });
    return;
  }

  const { username, password, remember } = login.data;
  const user = await checkAuth({ username, password });
  if (!user) {
    res.send({ error: "Invalid username or password" });
    return;
  }

  // Persist according to the request, falling back to the user's saved
  // "remember me" preference when the request doesn't specify.
  const security = await getSecurityStatus(user.userId);
  const effectiveRemember = remember ?? security.rememberMe;

  // COS 2.8: a valid session cookie overrides 2FA. If the caller already holds a
  // valid cookie for this same user, skip the OTP prompt and refresh the session.
  const hasValidCookie = req.session?.userId === user.userId;
  if (security.mfaEnabled && security.email && !hasValidCookie) {
    // Email a code and require verification before issuing a session (COS 2.6).
    const challengeId = await startLoginChallenge(user.userId, security.email, effectiveRemember);
    res.send({ mfaRequired: true, challengeId });
    return;
  }

  await issueSession(res, user.userId, effectiveRemember);
  res.send(await populateSafeUserInfo(user.userId));
};

/**
 * Maps an OTP verification failure to an HTTP status and message.
 */
function otpFailure(res: Response, reason: VerifyFailure): void {
  const status = reason === "expired" ? 410 : reason === "locked" ? 429 : 401;
  const message =
    reason === "expired"
      ? "Code expired"
      : reason === "locked"
        ? "Too many attempts"
        : "Invalid code";
  res.status(status).send({ error: message });
}

/**
 * Mint a session for a user and attach the cookie. Shared by password login and
 * the post-2FA verification step.
 */
async function issueSession(res: Response, userId: string, remember: boolean): Promise<void> {
  const { token, maxAgeMs } = await createSession(userId, remember);
  setSessionCookie(res, token, maxAgeMs);
}

/**
 * Completes a 2FA login by verifying the emailed code and, on success, issuing
 * the session cookie (honoring the original "remember me" choice).
 * @param req The request containing the challenge id and code.
 * @param res The response, returning the user or an OTP error.
 */
export const postLoginVerify: RestAPI<SafeUserInfo> = async (req, res) => {
  const parsed = zOtpVerifyRequest.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).send({ error: "Poorly-formed request" });
    return;
  }

  const result = await verifyChallenge(parsed.data.challengeId, parsed.data.code, "login");
  if (!result.ok) {
    otpFailure(res, result.reason);
    return;
  }

  await issueSession(res, result.challenge.userId, result.challenge.remember);
  res.send(await populateSafeUserInfo(result.challenge.userId));
};

/**
 * Returns the current user's 2FA configuration. Requires a session.
 * @param req The request, carrying the session resolved by `attachSession`.
 * @param res The response, returning the MFA status.
 */
export const getMfa: RestAPI<MfaStatus> = async (req, res) => {
  if (!req.session) {
    res.status(401).send({ error: "Not authenticated" });
    return;
  }
  res.send(await getMfaStatus(req.session.userId));
};

/**
 * Begins 2FA enrollment by emailing a confirmation code to the given address.
 * Requires a session. The email is not linked until the code is verified.
 * @param req The request containing the email to link.
 * @param res The response, returning the challenge id.
 */
export const postMfaEnroll: RestAPI<MfaEnrollStart> = async (req, res) => {
  if (!req.session) {
    res.status(401).send({ error: "Not authenticated" });
    return;
  }
  const parsed = zMfaEnrollRequest.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).send({ error: "Poorly-formed request" });
    return;
  }
  const challengeId = await startEnrollChallenge(req.session.userId, parsed.data.email);
  res.send({ challengeId });
};

/**
 * Verifies an enrollment code and, on success, links the email and turns on 2FA.
 * Requires a session.
 * @param req The request containing the challenge id and code.
 * @param res The response, returning the updated MFA status or an OTP error.
 */
export const postMfaVerify: RestAPI<MfaStatus> = async (req, res) => {
  if (!req.session) {
    res.status(401).send({ error: "Not authenticated" });
    return;
  }
  const parsed = zOtpVerifyRequest.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).send({ error: "Poorly-formed request" });
    return;
  }

  const result = await verifyChallenge(parsed.data.challengeId, parsed.data.code, "enroll");
  if (!result.ok) {
    otpFailure(res, result.reason);
    return;
  }
  // The challenge must belong to the logged-in user.
  if (result.challenge.userId !== req.session.userId) {
    res.status(403).send({ error: "Invalid credentials" });
    return;
  }

  await enableMfa(req.session.userId, result.challenge.email);
  res.send(await getMfaStatus(req.session.userId));
};

/**
 * Turns off 2FA and deletes the linked email (opt-out, COS 2.9). Requires a session.
 * @param req The request, carrying the session resolved by `attachSession`.
 * @param res The response, returning the updated MFA status.
 */
export const postMfaDisable: RestAPI<MfaStatus> = async (req, res) => {
  if (!req.session) {
    res.status(401).send({ error: "Not authenticated" });
    return;
  }
  await disableMfa(req.session.userId);
  res.send(await getMfaStatus(req.session.userId));
};

/**
 * Returns the current user's full security configuration (2FA + remember-me).
 * Requires a session.
 * @param req The request, carrying the session resolved by `attachSession`.
 * @param res The response, returning the security status.
 */
export const getSecurity: RestAPI<SecurityStatus> = async (req, res) => {
  if (!req.session) {
    res.status(401).send({ error: "Not authenticated" });
    return;
  }
  res.send(await getSecurityStatus(req.session.userId));
};

/**
 * Sets the persistent-session ("remember me") preference and re-issues the
 * current session cookie with that persistence so the change takes effect now.
 * Requires a session.
 * @param req The request containing `{ remember: boolean }`.
 * @param res The response, returning the updated security status.
 */
export const postRemember: RestAPI<SecurityStatus> = async (req, res) => {
  if (!req.session) {
    res.status(401).send({ error: "Not authenticated" });
    return;
  }
  const parsed = zRememberRequest.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).send({ error: "Poorly-formed request" });
    return;
  }

  await setUserRememberMe(req.session.userId, parsed.data.remember);
  // Replace the current session with one of the chosen persistence.
  await revokeSession(readCookie(req.headers.cookie, SESSION_COOKIE));
  await issueSession(res, req.session.userId, parsed.data.remember);
  res.send(await getSecurityStatus(req.session.userId));
};

/**
 * Revokes every session for the current user and clears the cookie (opt-out,
 * COS 2.9 — "sign out of all devices"). Requires a session.
 * @param req The request, whose session identifies the user.
 * @param res The response, confirming the sign-out.
 */
export const postRevokeAllSessions: RestAPI<LogoutResponse> = async (req, res) => {
  if (!req.session) {
    res.status(401).send({ error: "Not authenticated" });
    return;
  }
  await revokeAllSessionsForUser(req.session.userId);
  clearSessionCookie(res);
  res.send({ ok: true });
};

/**
 * Returns the currently logged-in user based on the session cookie, allowing
 * the client to restore a session (skip login) after a refresh. Requires a
 * valid session, enforced by `requireSession` on the route.
 * @param req The request, carrying the session resolved by `attachSession`.
 * @param res The response, returning the user's safe info.
 */
export const getMe: RestAPI<SafeUserInfo> = async (req, res) => {
  if (!req.session) {
    res.status(401).send({ error: "Not authenticated" });
    return;
  }
  res.send(await populateSafeUserInfo(req.session.userId));
};

/**
 * Logs the current user out by revoking their session and clearing the cookie.
 * @param req The request, whose session cookie identifies the session to revoke.
 * @param res The response, confirming logout.
 */
export const postLogout: RestAPI<LogoutResponse> = async (req, res) => {
  const token = readCookie(req.headers.cookie, SESSION_COOKIE);
  await revokeSession(token);
  clearSessionCookie(res);
  res.send({ ok: true });
};

/**
 * Update a user's information
 * @param req A request containing a new password
 * @param res The response, either returning the updated user or an error
 */
export const postByUsername: RestAPI<SafeUserInfo, { username: string }> = async (req, res) => {
  const body = withAuth(zUserUpdateRequest).safeParse(req.body);
  if (!body.success) {
    res.status(400).send({ error: "Poorly-formed request" });
    return;
  }

  const user = (await checkAuth(body.data.auth)) ?? req.session;
  if (!user || user.username !== req.params.username) {
    res.status(403).send({ error: "Invalid credentials" });
    return;
  }

  res.send(await updateUser(req.params.username, body.data.payload));
};

/**
 * Handles the creation of a new user account.
 * @param req The request containing username and password in the body.
 * @param res The response, either returning the created user or an error.
 * @returns A promise resolving to void.
 */
export const postSignup: RestAPI<SafeUserInfo> = async (req, res) => {
  const userAuth = zUserAuth.safeParse(req.body);
  if (!userAuth.success) {
    res.status(400).send({ error: "Poorly-formed request" });
    return;
  }

  const result = await createUser(userAuth.data.username, userAuth.data.password, new Date());

  // Signup logs the user in, so mint a session cookie too (same as login),
  // otherwise a refresh right after signing up would bounce back to login.
  if (!("error" in result)) {
    const created = await getUserByUsername(userAuth.data.username);
    if (created) {
      const { token, maxAgeMs } = await createSession(created.userId, false);
      setSessionCookie(res, token, maxAgeMs);
    }
  }

  res.send(result);
};

/**
 * Retrieves a user by their username.
 * @param req The request containing the username as a route parameter.
 * @param res The response, either returning the user (200) or an error.
 */
export const getByUsername: RestAPI<SafeUserInfo, { username: string }> = async (req, res) => {
  const user = await getUserByUsername(req.params.username);
  if (!user) {
    res.status(404).send({ error: "User not found" });
    return;
  }
  res.send(await populateSafeUserInfo(user.userId));
};

/**
 * Returns the user information for a list of users
 */
export const postList: RestAPI<SafeUserInfo[]> = async (req, res) => {
  const usernames = z.array(z.string()).safeParse(req.body);
  if (!usernames.success) {
    res.status(400).send({ error: "Poorly-formed request" });
    return;
  }

  let users: SafeUserInfo[];
  try {
    users = await getUsersByUsername(usernames.data);
  } catch {
    res.send({ error: "Usernames do not all exist" });
    return;
  }

  res.send(users);
};
