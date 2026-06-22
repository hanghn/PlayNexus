import { z } from "zod";
import { type SafeUserInfo } from "./user.types.ts";
import { type MessageInfo } from "./message.types.ts";

/**
 * A direct-message thread as exposed to the client.
 * - `threadId`: database key
 * - `participants`: exactly two users in this conversation
 * - `messages`: ordered message history
 * - `createdAt`: when the thread was opened
 */
export interface DMThreadInfo {
  threadId: string;
  participants: [SafeUserInfo, SafeUserInfo];
  messages: MessageInfo[];
  createdAt: Date;
}

/**
 * Pushed over the socket when a new message lands in a DM thread, so both
 * participants update in real time.
 */
export interface DMNewMessagePayload {
  threadId: string;
  message: MessageInfo;
}

/*** TYPES USED IN THE DM API ***/

/**
 * Payload to open (or retrieve) a DM thread with another user.
 */
export type DMThreadOpenPayload = z.infer<typeof zDMThreadOpenPayload>;
export const zDMThreadOpenPayload = z.object({
  withUsername: z.string(),
});

/**
 * Payload to send a message inside a DM thread.
 */
export type DMSendPayload = z.infer<typeof zDMSendPayload>;
export const zDMSendPayload = z.object({
  threadId: z.string(),
  text: z.string(),
});
