import { type SafeUserInfo, type SecurityStatus, type UserUpdateRequest } from "@gamenite/shared";
import { getUserByUsername, updateAuth } from "./auth.service.ts";
import { UserRepo } from "../repository.ts";

const disallowedUsernames = new Set(["login", "logout", "signup", "list", "me", "mfa", "security"]);

/**
 * Retrieves a single user from the database.
 *
 * @param userId - Valid user id.
 * @returns the found user object (without the password).
 */
export async function populateSafeUserInfo(userId: string): Promise<SafeUserInfo> {
  const record = await UserRepo.get(userId);
  return {
    username: record.username,
    display: record.display,
    createdAt: new Date(record.createdAt),
    bio: record.bio,
    accentColor: record.accentColor,
    avatarUrl: record.avatarUrl,
  };
}

/**
 * Create and store a new user
 *
 * @param newUser - The user object to be saved, containing user details like username, password, etc.
 * @returns Resolves with the saved user object (without the password) or an error message.
 */
export async function createUser(
  username: string,
  password: string,
  createdAt: Date,
): Promise<SafeUserInfo | { error: string }> {
  if ((await getUserByUsername(username)) !== null) {
    return { error: "User already exists" };
  }
  if (disallowedUsernames.has(username)) {
    return { error: "That is not a permitted username" };
  }
  const id = await UserRepo.add({
    username,
    createdAt: createdAt.toISOString(),
    display: username,
    bio: "",
    accentColor: "",
  });
  await updateAuth(username, password, id);
  return {
    username,
    createdAt,
    display: username,
    bio: "",
    accentColor: "",
  };
}

/**
 * Retrieves a list of usernames from the database
 *
 * @param usernames - A list of usernames
 * @returns the SafeUserInfo objects corresponding to those users
 * @throws if any of the usernames are not valid
 */
export async function getUsersByUsername(usernames: string[]): Promise<SafeUserInfo[]> {
  return Promise.all(
    usernames.map(async (username) => {
      const user = await getUserByUsername(username);
      if (user === null) {
        throw new Error(`No user ${username}`);
      }
      return populateSafeUserInfo(user.userId);
    }),
  );
}

/**
 * Returns a user's full security configuration (2FA status + remember-me).
 *
 * @param userId - the user to read
 * @returns the user's `SecurityStatus`
 */
export async function getSecurityStatus(userId: string): Promise<SecurityStatus> {
  const user = await UserRepo.get(userId);
  return {
    mfaEnabled: Boolean(user.mfaEnabled),
    email: user.email,
    rememberMe: Boolean(user.rememberMe),
  };
}

/**
 * Sets a user's persistent-session ("remember me") preference.
 *
 * @param userId - the user to update
 * @param remember - whether their sessions should be persistent
 */
export async function setUserRememberMe(userId: string, remember: boolean): Promise<void> {
  const user = await UserRepo.get(userId);
  user.rememberMe = remember;
  await UserRepo.set(userId, user);
}

/**
 * Updates user information in the database
 *
 * @param username - A valid username for the user to update
 * @param updates - An object that defines the fields to be updated and their new values
 * @returns the updated user object (without the password)
 * @throws if the username does not exist in the database
 */
export async function updateUser(
  username: string,
  { display, password, bio, accentColor, avatarUrl }: UserUpdateRequest,
): Promise<SafeUserInfo> {
  const user = await getUserByUsername(username);
  if (!user) throw new Error(`No user ${username}`);
  if (password !== undefined) await updateAuth(username, password, user.userId);
  const newUser = await UserRepo.get(user.userId);
  if (display !== undefined) newUser.display = display;
  if (bio !== undefined) newUser.bio = bio;
  if (accentColor !== undefined) newUser.accentColor = accentColor;
  if (avatarUrl !== undefined) newUser.avatarUrl = avatarUrl;
  await UserRepo.set(user.userId, newUser);
  return populateSafeUserInfo(user.userId);
}
