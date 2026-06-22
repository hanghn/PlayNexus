import type {
  ErrorMsg,
  LoginResult,
  MfaEnrollStart,
  MfaStatus,
  SafeUserInfo,
  SecurityStatus,
  UserAuth,
  UserUpdateRequest,
} from "@gamenite/shared";
import { isAxiosError } from "axios";
import { api, apiErrorMessage } from "./api.ts";

const USER_API_URL = `/api/user`;

type AuthResult = {
  user: SafeUserInfo;
  accessToken: string;
  session?: never;
  supabaseUserId?: never;
};

/**
 * Thrown by `loginUser` when the account has 2FA enabled: the password was
 * correct and a code has been emailed, but a session is not issued until the
 * code is verified via `verifyLoginOtp`. Carries the challenge id to verify
 * against. (The login UI that prompts for the code is wired up in branch 3.)
 */
export class MfaRequiredError extends Error {
  readonly challengeId: string;

  constructor(challengeId: string) {
    super("Two-factor authentication required");
    this.name = "MfaRequiredError";
    this.challengeId = challengeId;
  }
}

/**
 * Logs a user in. On success the server sets an HttpOnly session cookie; when
 * `remember` is true the cookie is persistent. If the account has 2FA enabled,
 * throws `MfaRequiredError` (a code has been emailed) instead of returning.
 */
export const loginUser = async (auth: UserAuth, remember = false): Promise<AuthResult> => {
  const res = await api.post<LoginResult | ErrorMsg>(`${USER_API_URL}/login`, {
    ...auth,
    remember,
  });
  if ("error" in res.data) throw new Error(res.data.error);
  if ("mfaRequired" in res.data) throw new MfaRequiredError(res.data.challengeId);
  return {
    user: res.data,
    accessToken: auth.password,
  };
};

/**
 * Completes a 2FA login by submitting the emailed code for the challenge id from
 * `MfaRequiredError`. On success the server sets the session cookie.
 */
export const verifyLoginOtp = async (challengeId: string, code: string): Promise<SafeUserInfo> => {
  const res = await api.post<SafeUserInfo | ErrorMsg>(`${USER_API_URL}/login/verify`, {
    challengeId,
    code,
  });
  if ("error" in res.data) throw new Error(res.data.error);
  return res.data;
};

/** Returns the current user's 2FA configuration (requires a session cookie). */
export const getMfaStatus = async (): Promise<MfaStatus> => {
  const res = await api.get<MfaStatus | ErrorMsg>(`${USER_API_URL}/mfa`);
  if ("error" in res.data) throw new Error(res.data.error);
  return res.data;
};

/**
 * Starts 2FA enrollment by emailing a confirmation code to `email`. Returns the
 * challenge id to verify with `verifyMfaEnroll`.
 */
export const startMfaEnroll = async (email: string): Promise<MfaEnrollStart> => {
  const res = await api.post<MfaEnrollStart | ErrorMsg>(`${USER_API_URL}/mfa/enroll`, { email });
  if ("error" in res.data) throw new Error(res.data.error);
  return res.data;
};

/** Verifies an enrollment code, linking the email and enabling 2FA on success. */
export const verifyMfaEnroll = async (challengeId: string, code: string): Promise<MfaStatus> => {
  const res = await api.post<MfaStatus | ErrorMsg>(`${USER_API_URL}/mfa/verify`, {
    challengeId,
    code,
  });
  if ("error" in res.data) throw new Error(res.data.error);
  return res.data;
};

/** Disables 2FA and deletes the linked email (requires a session cookie). */
export const disableMfa = async (): Promise<MfaStatus> => {
  const res = await api.post<MfaStatus | ErrorMsg>(`${USER_API_URL}/mfa/disable`);
  if ("error" in res.data) throw new Error(res.data.error);
  return res.data;
};

/** Returns the current user's full security configuration (2FA + remember-me). */
export const getSecurity = async (): Promise<SecurityStatus> => {
  const res = await api.get<SecurityStatus | ErrorMsg>(`${USER_API_URL}/security`);
  if ("error" in res.data) throw new Error(res.data.error);
  return res.data;
};

/**
 * Sets the persistent-session ("remember me") preference; the server re-issues
 * the session cookie so the change takes effect immediately.
 */
export const setRemember = async (remember: boolean): Promise<SecurityStatus> => {
  const res = await api.post<SecurityStatus | ErrorMsg>(`${USER_API_URL}/security/remember`, {
    remember,
  });
  if ("error" in res.data) throw new Error(res.data.error);
  return res.data;
};

/** Signs out of all devices, deleting every session for the user (COS 2.9). */
export const revokeAllSessions = async (): Promise<void> => {
  try {
    await api.post(`${USER_API_URL}/security/revoke-all`);
  } catch (err) {
    throw new Error(apiErrorMessage(err, "Could not sign out of all devices"));
  }
};

/**
 * Restores the logged-in user from the session cookie, or null if there is no
 * valid session. Lets the app skip the login screen after a refresh.
 */
export const getSession = async (): Promise<SafeUserInfo | null> => {
  // Try twice: a 401 (or error body) means there's genuinely an error, but one failure doesn't take us down
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const res = await api.get<SafeUserInfo | ErrorMsg>(`${USER_API_URL}/me`);
      return "error" in res.data ? null : res.data;
    } catch (err) {
      if (isAxiosError(err) && err.response) return null;
      if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 400));
    }
  }
  return null;
};

/**
 * Logs the current user out, revoking their session and clearing the cookie.
 */
export const logoutUser = async (): Promise<void> => {
  await api.post(`${USER_API_URL}/logout`);
};

/**
 * Creates a new Supabase Auth user and seeds the profile row for that user.
 */
export const signupUser = async (user: UserAuth): Promise<AuthResult> => {
  const res = await api.post<SafeUserInfo | ErrorMsg>(`${USER_API_URL}/signup`, user);
  if ("error" in res.data) throw new Error(res.data.error);
  return {
    user: res.data,
    accessToken: user.password,
  };
};

/**
 * Sends a POST request to update parts of a user's profile
 */
export const updateUser = async (
  auth: UserAuth,
  updates: UserUpdateRequest,
): Promise<SafeUserInfo> => {
  const res = await api.post<SafeUserInfo | ErrorMsg>(`${USER_API_URL}/${auth.username}`, {
    auth,
    payload: updates,
  });
  if ("error" in res.data) throw new Error(res.data.error);
  return res.data;
};

/**
 * Sends a GET request for a user's data
 */
export const getUserById = async (username: string): Promise<SafeUserInfo> => {
  const res = await api.get<SafeUserInfo | ErrorMsg>(`${USER_API_URL}/${username}`);
  if ("error" in res.data) throw new Error(res.data.error);
  return res.data;
};
