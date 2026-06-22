import { z } from "zod";
import { type GameKey } from "./game.types.ts";
import { type SafeUserInfo } from "./user.types.ts";

/**
 * Game invitations let one player invite a friend to a game they have just
 * created. The recipient is notified in real time and, on accepting, auto-joins
 * the game's lobby.
 */

/** Body for POST /api/game/invite — invite `toUsername` to the game `gameId`. */
export const zGameInvitePayload = z.object({
  toUsername: z.string(),
  gameId: z.string(),
});
export type GameInvitePayload = z.infer<typeof zGameInvitePayload>;

/** A live game invitation pushed to the recipient over the socket. */
export interface GameInvitationInfo {
  gameId: string;
  gameType: GameKey;
  from: SafeUserInfo;
  toUsername: string;
  createdAt: Date;
}

/** Body for POST /api/game/invite/decline — decline the invite to `gameId`. */
export const zGameInviteDeclinePayload = z.object({
  gameId: z.string(),
  inviterUsername: z.string(),
});
export type GameInviteDeclinePayload = z.infer<typeof zGameInviteDeclinePayload>;

/** Pushed to the inviter when a recipient declines their invitation. */
export interface GameInviteDeclinedInfo {
  gameId: string;
  gameType: GameKey;
  by: SafeUserInfo;
  inviterUsername: string;
}
