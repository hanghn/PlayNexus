import { z } from "zod";

/**
 * Represents a "safe" user object that excludes sensitive information like
 * the password, suitable for exposing to clients,
 * - `username`: unique username of the user
 * - `display`: A display name
 * - `createdAt`: when this when the user registered.
 * - `bio`: Optional profile bio text.
 * - `accentColor`: Optional hex color string for profile accent.
 */
export interface SafeUserInfo {
  username: string;
  display: string;
  bio?: string;
  createdAt: Date;
  accentColor?: string;
  avatarUrl?: string;
}

/*** TYPES USED IN THE USER API ***/

/**
 * Represents allowed updates to a user.
 */
export type UserUpdateRequest = z.infer<typeof zUserUpdateRequest>;
export const zUserUpdateRequest = z.object({
  password: z.string().optional(),
  display: z.string().optional(),
  bio: z.string().optional(),
  accentColor: z.string().optional(),
  avatarUrl: z.string().optional(),
});
