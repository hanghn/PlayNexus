import type {
  ErrorMsg,
  GameInfo,
  GameInvitationInfo,
  GameInviteDeclinedInfo,
  GameKey,
  UserAuth,
} from "@gamenite/shared";
import { api } from "./api.ts";

const GAME_API_URL = `/api/game`;

/**
 * Sends a POST request to create a game.
 *
 * @param auth - Caller's auth token
 * @param gameKey - Which game to create
 * @param singlePlayer - If true, start immediately against an Easy AI (cribbage only)
 */
export const createGame = async (
  auth: UserAuth,
  gameKey: GameKey,
  singlePlayer?: boolean,
  difficulty?: "easy" | "hard",
): Promise<GameInfo> => {
  const res = await api.post<GameInfo | ErrorMsg>(`${GAME_API_URL}/create`, {
    auth,
    payload: { type: gameKey, singlePlayer: singlePlayer ?? false, difficulty },
  });
  if ("error" in res.data) throw new Error(res.data.error);
  return res.data;
};

/**
 * Invite a friend to an existing game. The server pushes a live
 * `gameInvitationReceived` event to the recipient.
 */
export const sendGameInvite = async (
  auth: UserAuth,
  toUsername: string,
  gameId: string,
): Promise<GameInvitationInfo> => {
  const res = await api.post<GameInvitationInfo | ErrorMsg>(`${GAME_API_URL}/invite`, {
    auth,
    payload: { toUsername, gameId },
  });
  if ("error" in res.data) throw new Error(res.data.error);
  return res.data;
};

/**
 * Fetch the pending game invitations addressed to a user (so invites sent while
 * they were offline show up when they log in).
 */
export const getMyInvitations = async (username: string): Promise<GameInvitationInfo[]> => {
  const res = await api.get<GameInvitationInfo[] | ErrorMsg>(`${GAME_API_URL}/invite/list`, {
    params: { username },
  });
  if ("error" in res.data) throw new Error(res.data.error);
  return res.data;
};

/**
 * Decline a game invitation. The server pushes a live `gameInviteDeclined`
 * event so the inviter knows and can invite someone else.
 */
export const declineGameInvite = async (
  auth: UserAuth,
  gameId: string,
  inviterUsername: string,
): Promise<GameInviteDeclinedInfo> => {
  const res = await api.post<GameInviteDeclinedInfo | ErrorMsg>(`${GAME_API_URL}/invite/decline`, {
    auth,
    payload: { gameId, inviterUsername },
  });
  if ("error" in res.data) throw new Error(res.data.error);
  return res.data;
};

/**
 * Sends a GET request to get a game
 */
export const getGameById = async (gameId: string): Promise<GameInfo> => {
  const res = await api.get<GameInfo | ErrorMsg>(`${GAME_API_URL}/${gameId}`);
  if ("error" in res.data) throw new Error(res.data.error);
  return res.data;
};

/**
 * Sends a GET request for all games
 */
export const gameList = async (): Promise<GameInfo[]> => {
  const res = await api.get<GameInfo[] | ErrorMsg>(`${GAME_API_URL}/list`);
  if ("error" in res.data) throw new Error(res.data.error);
  return res.data;
};
