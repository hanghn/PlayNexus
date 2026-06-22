import { AuthRepo } from "../repository.ts";
import type { UserWithId } from "../types.ts";
import type { UserAuth } from "@gamenite/shared";
import { getSupabaseAdmin } from "../supabaseAdmin.ts";

/**
 * Retrieves a single user from the database.
 *
 * @param username - The username of the user to find
 * @returns the found user object (without the password) or null
 */
export async function getUserByUsername(username: string): Promise<UserWithId | null> {
  const auth = await AuthRepo.find(username);
  if (!auth) return null;
  return { userId: auth.userId, username };
}

/**
 * Create or update the authentication information associated with a specific
 * username
 *
 * @param username
 * @param password
 * @param userId the User model connected to this username
 */
export async function updateAuth(username: string, password: string, userId: string) {
  await AuthRepo.set(username, { password, userId: userId });
}

/**
 * Takes a username and password, and either returns the corresponding user object
 * (without the password) or null if the username/password combination does not
 * match stored values.
 *
 * @param auth - A user's authentication information (username and password)
 * @returns the corresponding user object (without the password) or null.
 */
export async function checkAuth({ username, password }: UserAuth): Promise<UserWithId | null> {
  const tokenUser = await getUserFromSupabaseToken(password);
  if (tokenUser) return tokenUser.username === username ? tokenUser : null;
  const auth = await AuthRepo.find(username);
  if (!auth) return null;
  if (password !== auth.password) return null;
  return { username, userId: auth.userId };
}

/**
 * Takes a username and password, and returns the corresponding user
 * (without the password) or an error if the username/password combination
 * doesn't match stored values.
 *
 * @param auth - A user's authentication information (username and password)
 * @returns the corresponding user object (without the password)
 * @throws if the auth information is incorrect
 */
export async function enforceAuth(auth: UserAuth): Promise<UserWithId> {
  const user = await checkAuth(auth);
  if (!user) throw new Error("Invalid auth");
  return user;
}

/**
 * Resolve a Supabase access token to UserWithId.
 * Returns null if token is missing/invalid.
 */
export async function getUserFromSupabaseToken(authorization?: string): Promise<UserWithId | null> {
  if (!authorization) return null;
  const token = authorization.startsWith("Bearer ") ? authorization.split(" ")[1] : authorization;
  if (!token) return null;

  try {
    const result = await getSupabaseAdmin().auth.getUser(token);
    const user = result.data.user;
    if (result.error || !user) return null;

    const metadata = user.user_metadata as { username?: string } | undefined;
    const username = metadata?.username ?? user.email ?? "";
    return { username, userId: user.id };
  } catch {
    return null;
  }
}

/**
 * Enforce a valid Supabase bearer token or throw.
 */
export async function enforceAuthToken(authorization?: string): Promise<UserWithId> {
  const user = await getUserFromSupabaseToken(authorization);
  if (!user) throw new Error("Invalid auth token");
  return user;
}
