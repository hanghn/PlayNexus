import type { GameKey } from "@gamenite/shared";

/**
 * Record identifiers used to look up records in a database. This type
 * abbreviation is intended to suggest that the key should be a randomly
 * generated unique ID.
 */
export type RecordId = string;

/**
 * Actual JavaScript Date objects can't stored in a database that only accepts
 * JSON objects; this type indicates that the string should be the result of
 * taking a Date object and turning it to a string with the Date.toISOString()
 * method.
 */
export type DateISO = string;

/**
 * Represents a user's authorization record in the database.
 * - `userId`: the user ID of the corresponding User model
 * - `password`: the password for this user
 */
export interface AuthRecord {
  userId: RecordId; // References User models
  password: string;
}

/**
 * Represents a chat document in the database.
 * - `messages`: the ordered list of messages in the chat
 * - `createdAt`: when the chat was created
 */
export interface ChatRecord {
  messages: RecordId[]; // References Message models
  createdAt: DateISO;
}

/**
 * Represents a comment in the database.
 * - `text`: comment contents
 * - `createdBy`: user id of the commenter
 * - `createdAt`: when the comment was made
 * - `editedAt`: when the comment was last modified
 */
export interface CommentRecord {
  text: string;
  createdBy: RecordId; // References User records
  createdAt: DateISO;
  editedAt?: DateISO;
}

/**
 * Represents a game document in the database.
 * - `type`: picks which game this is
 * - `state`: absent if the game hasn't started, or the id for the game's state
 * - `chat`: id for the game's chat
 * - `players`: active players for the game
 * - `createdAt`: when the game was created
 * - `createdBy`: user id of the person who created the game
 */
export interface GameRecord {
  type: GameKey;
  state?: unknown;
  done: boolean;
  chat: RecordId; // References Chat records
  players: RecordId[]; // References User records (AI sentinel allowed)
  createdAt: DateISO;
  createdBy: RecordId; // References User records
  /** True when the game was created in single-player mode (human vs Easy AI). */
  singlePlayer?: boolean;
}

/**
 * Represents a message in the database.
 * - `text`: message contents
 * - `createdBy`: user id of message sender
 * - `createdAt`: when the message was sent
 */
export interface MessageRecord {
  text: string;
  createdBy: RecordId; // References User records
  createdAt: DateISO;
}

/**
 * Represents a forum post as it's stored in the database.
 * - `title`: post title
 * - `text`: post contents
 * - `createdAt`: when the thread was posted
 * - `createdBy`: user id of OP
 * - `comments`: replies to the post
 */
export interface ThreadRecord {
  title: string;
  text: string;
  createdAt: DateISO;
  createdBy: RecordId; // References User records
  comments: RecordId[]; // References Comment records
}

/**
 * Represents a user document in the database.
 * - `username`: Text username (a non-random key for looking up Auth records)
 * - `display`: A display name
 * - `bio`: A short, user-written biography
 * - `accent`: A CSS color used to accent the user's profile
 * - `createdAt`: when this user registered.
 * - `bio`: Optional profile bio text.
 * - `accentColor`: Optional hex color string for profile accent.
 * - `avatarUrl`: Optional URL for the user's profile image.
 */
export interface UserRecord {
  username: string; // References Auth records
  display: string;
  accent?: string;
  createdAt: DateISO;
  bio?: string;
  accentColor?: string;
  avatarUrl?: string;
  /** Email linked for 2FA; present only while `mfaEnabled` is true. */
  email?: string;
  /** Whether email-based two-factor auth is enabled for this user. */
  mfaEnabled?: boolean;
  /** Whether sessions for this user should be persistent ("remember me"). */
  rememberMe?: boolean;
}

/**
 * Represents a friend request / friendship in the database.
 * - `fromUserId`: user who sent the request
 * - `toUserId`: user who received the request
 * - `status`: current lifecycle state
 * - `createdAt`: when the request was sent
 * - `updatedAt`: when the status last changed
 */
export interface FriendshipRecord {
  fromUserId: RecordId; // References User records
  toUserId: RecordId; // References User records
  status: "pending" | "accepted" | "rejected" | "blocked";
  createdAt: DateISO;
  updatedAt: DateISO;
}

/**
 * Represents a direct-message thread in the database.
 * - `participants`: exactly two user IDs in this conversation
 * - `messages`: ordered list of message IDs
 * - `createdAt`: when the thread was first opened
 */
export interface DMThreadRecord {
  participants: [RecordId, RecordId]; // References User records
  messages: RecordId[]; // References Message records
  createdAt: DateISO;
}
