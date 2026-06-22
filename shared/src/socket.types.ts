import {
  type ChatInfo,
  type ChatNewMessagePayload,
  type ChatUserJoinedPayload,
  type ChatUserLeftPayload,
} from "./chat.types.ts";
import { type NewMessagePayload } from "./message.types.ts";
import { type DMSendPayload, type DMNewMessagePayload } from "./dm.types.ts";
import { type WithAuth } from "./auth.types.ts";
import { type GameMakeMovePayload, type GamePlayInfo, type TaggedGameView } from "./game.types.ts";
import { type SafeUserInfo } from "./user.types.ts";
import { type FriendshipInfo } from "./friend.types.ts";
import { type GameInvitationInfo, type GameInviteDeclinedInfo } from "./game-invitation.types.ts";

/**
 * The Socket.io interface for client to server communication
 */
export interface ClientToServerEvents {
  chatJoin: (payload: WithAuth<string>) => void;
  chatLeave: (payload: WithAuth<string>) => void;
  chatSendMessage: (payload: WithAuth<NewMessagePayload>) => void;
  gameJoinAsPlayer: (payload: WithAuth<string>) => void;
  gameLeave: (payload: WithAuth<string>) => void;
  gameMakeMove: (payload: WithAuth<GameMakeMovePayload>) => void;
  gameStart: (payload: WithAuth<string>) => void;
  gameWatch: (payload: WithAuth<string>) => void;
  // Notify server that a user is online (sent from client). Auth here only needs username.
  userOnline: (payload: { auth: { username: string } }) => void;
  // Request the current online-users list (server replies with onlineUsers event).
  getOnlineUsers: () => void;
  // Subscribe/unsubscribe to a DM thread's real-time room (payload = threadId)
  dmJoin: (payload: WithAuth<string>) => void;
  dmLeave: (payload: WithAuth<string>) => void;
  // Send a message inside a DM thread
  dmSendMessage: (payload: WithAuth<DMSendPayload>) => void;
  // Delete one of your own messages (DM thread / game chat)
  dmDeleteMessage: (payload: WithAuth<{ threadId: string; messageId: string }>) => void;
  chatDeleteMessage: (payload: WithAuth<{ chatId: string; messageId: string }>) => void;
}

/**
 * The Socket.io interface for server to client information
 */
export interface ServerToClientEvents {
  chatJoined: (payload: ChatInfo) => void;
  chatNewMessage: (payload: ChatNewMessagePayload) => void;
  chatUserJoined: (payload: ChatUserJoinedPayload) => void;
  chatUserLeft: (payload: ChatUserLeftPayload) => void;
  gamePlayersUpdated: (payload: SafeUserInfo[]) => void;
  gameStateUpdated: (payload: TaggedGameView & { forPlayer: boolean }) => void;
  gameWatched: (payload: GamePlayInfo) => void;
  // A per-action error (e.g. a rejected join) surfaced back to the acting client
  gameError: (payload: { action: string; message: string }) => void;
  // An informational room message (e.g. "X left the game")
  gameNotice: (payload: { message: string }) => void;
  // Broadcast current online usernames to clients
  onlineUsers: (payload: string[]) => void;
  // Notify users of a new pending friend request (recipient reacts to its own)
  friendRequestReceived: (payload: FriendshipInfo) => void;
  // Notify a user they've been invited to a game (recipient reacts to its own)
  gameInvitationReceived: (payload: GameInvitationInfo) => void;
  // Notify the inviter that a recipient declined their invitation
  gameInviteDeclined: (payload: GameInviteDeclinedInfo) => void;
  // Deliver a new DM message to everyone in the thread's room
  dmNewMessage: (payload: DMNewMessagePayload) => void;
  // Notify a recipient of a new DM even when they aren't viewing the thread
  // (delivered to their personal user room) — drives the unread badge + toast
  dmNotification: (payload: {
    threadId: string;
    from: { username: string; display: string };
  }) => void;
  // Tell everyone in a room that a message was deleted, so they remove it
  dmMessageDeleted: (payload: { threadId: string; messageId: string }) => void;
  chatMessageDeleted: (payload: { chatId: string; messageId: string }) => void;
}
