import {
  type GameInfo,
  type GameInvitationInfo,
  type GameInviteDeclinedInfo,
  type UserAuth,
  withAuth,
  zCreateGamePayload,
  zGameInvitePayload,
  zGameInviteDeclinePayload,
  zGameMakeMovePayload,
} from "@gamenite/shared";
import {
  type RestAPI,
  type GameViewUpdates,
  type SocketAPI,
  type GameServer,
  type UserWithId,
} from "../types.ts";
import {
  createGame,
  gameServices,
  getGameById,
  getGames,
  getInvitationsForUser,
  joinGame,
  leaveGame,
  removeInvitation,
  startGame,
  storeInvitation,
  updateGame,
  viewGame,
} from "../services/game.service.ts";
import { z } from "zod";
import { logSocketError, getSocketServer } from "./socket.controller.ts";
import { checkAuth, getUserByUsername } from "../services/auth.service.ts";
import { populateSafeUserInfo } from "../services/user.service.ts";

/**
 * Resolve the acting user for a game socket request. Prefer the explicit login
 * token over the socket's session cookie, so a stale cookie left over from a
 * previous login can't act as (or be rejected as) the wrong user. Falls back to
 * the cookie session when no valid token was sent (e.g. cookie-only auth).
 */
async function resolveActor(
  sessionUser: Promise<UserWithId | null> | UserWithId | null | undefined,
  auth: UserAuth,
): Promise<UserWithId> {
  const user = (await checkAuth(auth)) ?? (await sessionUser);
  if (!user) throw new Error("Invalid auth");
  return user;
}

/**
 * Handle POST requests to `/api/game/create` by creating a game. The game
 * starts with one player, the user who made the POST request.
 */
export const postCreate: RestAPI<GameInfo> = async (req, res) => {
  const body = withAuth(zCreateGamePayload).safeParse(req.body);
  if (body.error) {
    res.status(400).send({ error: "Poorly-formed request" });
    return;
  }

  // Prefer the explicit login token over the session cookie, so a stale cookie
  // from a previous login can't be recorded as the game's creator (which made
  // single-player games show "another human" as player #1 instead of you).
  const user = (await checkAuth(body.data.auth)) ?? req.session;
  if (!user) {
    res.status(403).send({ error: "Invalid credentials" });
    return;
  }

  const { type, singlePlayer, difficulty } = body.data.payload;
  try {
    const game = await createGame(user, type, new Date(), singlePlayer, difficulty);
    res.send(game);
  } catch (err) {
    // e.g. the one-game-at-a-time rule rejected the creation
    res.status(400).send({ error: err instanceof Error ? err.message : "Could not create game." });
  }
};

/**
 * Handle POST requests to `/api/game/invite` by inviting a friend to a game.
 * Pushes a live `gameInvitationReceived` event so the recipient sees the invite
 * immediately and can accept to auto-join the lobby.
 */
export const postInvite: RestAPI<GameInvitationInfo> = async (req, res) => {
  const body = withAuth(zGameInvitePayload).safeParse(req.body);
  if (!body.success) {
    res.status(400).send({ error: "Poorly-formed request" });
    return;
  }

  // Prefer the explicit login token over the session cookie (see postCreate).
  const user = (await checkAuth(body.data.auth)) ?? req.session;
  if (!user) {
    res.status(403).send({ error: "Invalid credentials" });
    return;
  }

  const { toUsername, gameId } = body.data.payload;
  const recipient = await getUserByUsername(toUsername);
  if (!recipient) {
    res.status(404).send({ error: "User not found" });
    return;
  }

  const game = await getGameById(gameId);
  if (!game) {
    res.status(404).send({ error: "Game not found" });
    return;
  }

  const invitation: GameInvitationInfo = {
    gameId,
    gameType: game.type,
    from: await populateSafeUserInfo(user.userId),
    toUsername: recipient.username,
    createdAt: new Date(),
  };

  // Persist so an offline recipient sees it on login, then push it live.
  storeInvitation(invitation);
  getSocketServer()?.emit("gameInvitationReceived", invitation);
  res.send(invitation);
};

/**
 * Handle GET requests to `/api/game/invite/list?username=` by returning the
 * pending invitations addressed to a user (used to surface invites at login).
 */
export const getInviteList: RestAPI<GameInvitationInfo[]> = async (req, res) => {
  const username = typeof req.query["username"] === "string" ? req.query["username"] : null;
  if (!username) {
    res.status(400).send({ error: "username query param required" });
    return;
  }
  res.send(await getInvitationsForUser(username));
};

/**
 * Handle POST requests to `/api/game/invite/decline`. Pushes a live
 * `gameInviteDeclined` event so the inviter learns the recipient declined and
 * can invite someone else.
 */
export const postInviteDecline: RestAPI<GameInviteDeclinedInfo> = async (req, res) => {
  const body = withAuth(zGameInviteDeclinePayload).safeParse(req.body);
  if (!body.success) {
    res.status(400).send({ error: "Poorly-formed request" });
    return;
  }

  const user = (await checkAuth(body.data.auth)) ?? req.session;
  if (!user) {
    res.status(403).send({ error: "Invalid credentials" });
    return;
  }

  const { gameId, inviterUsername } = body.data.payload;
  const game = await getGameById(gameId);
  if (!game) {
    res.status(404).send({ error: "Game not found" });
    return;
  }

  // Forget the persisted invite so it doesn't reappear on the decliner's login.
  removeInvitation(gameId, user.username);

  const declined: GameInviteDeclinedInfo = {
    gameId,
    gameType: game.type,
    by: await populateSafeUserInfo(user.userId),
    inviterUsername,
  };

  // Broadcast to everyone; the client only reacts if it's the inviter (and never
  // the decliner). Broadcasting avoids depending on socket-room membership, which
  // a reconnect would drop.
  getSocketServer()?.emit("gameInviteDeclined", declined);
  res.send(declined);
};

/**
 * Handle GET requests to `/api/game/:id`. Returns either 404 or a game info
 * object.
 */
export const getById: RestAPI<GameInfo, { id: string }> = async (req, res) => {
  const game = await getGameById(req.params.id);
  if (!game) {
    res.status(404).send({ error: "Game not found" });
    return;
  }

  res.send(game);
};

/**
 * Handle GET requests to `/api/game/list` by returning information about all
 * games, sorted in reverse chronological order by creation.
 */
export const getList: RestAPI<GameInfo[]> = async (req, res) => {
  res.send(await getGames());
};

/**
 * Each active game player gets a dedicated room that sends messages
 * to just their socket connections. This function derives that room name from
 * the game id and the username.
 *
 * @param gameId - the game id, also the 'base' room name
 * @param userId - user id (not username!)
 * @returns a room name unique to that game id and user
 */
function userRoom(gameId: string, user: string) {
  return `${gameId}-${user}`;
}

/**
 * Handle the socket request sent by a user when they load to a game page. The
 * server's job is to respond with full information about the game's current
 * players and the appropriate view of the game's state. The server also needs
 * to register the user for future updates about the game's state.
 */
export const socketWatch: SocketAPI = (socket) => async (body) => {
  try {
    const { auth, payload: gameId } = withAuth(z.string()).parse(body);
    const user = await resolveActor(socket.data?.sessionUser, auth);
    const { isPlayer, view, players } = await viewGame(gameId, user);
    const roomsToJoin = isPlayer ? [gameId, userRoom(gameId, user.userId)] : [gameId];
    await socket.join(roomsToJoin);
    socket.emit("gameWatched", { gameId, view, players });
  } catch (err) {
    logSocketError(socket, err);
  }
};

/**
 * Broadcast view updates to appropriate users
 */
function sendViewUpdates(io: GameServer, gameId: string, updates: GameViewUpdates) {
  io.to(gameId).emit("gameStateUpdated", { ...updates.watchers, forPlayer: false });
  for (const { userId, view } of updates.players) {
    io.to(userRoom(gameId, userId)).emit("gameStateUpdated", { ...view, forPlayer: true });
  }
}

/**
 * Handle the socket request sent by a user when they try to join a game.
 */
export const socketJoinAsPlayer: SocketAPI = (socket, io) => async (body) => {
  try {
    const { auth, payload: gameId } = withAuth(z.string()).parse(body);
    const user = await resolveActor(socket.data?.sessionUser, auth);
    const game = await joinGame(gameId, user);

    // Let everyone know the user joined (`io` instead of `socket` includes
    // the joiner)
    io.to(gameId).emit("gamePlayersUpdated", game.players);

    // This socket should receive user-specific updates for this game, if it
    // isn't already
    if (!socket.rooms.has(userRoom(gameId, user.userId))) {
      await socket.join(userRoom(gameId, user.userId));
    }

    // If the game is full, it starts automatically
    if (game.players.length === gameServices[game.type].maxPlayers) {
      sendViewUpdates(io, gameId, await startGame(gameId, user));
    }
  } catch (err) {
    logSocketError(socket, err);
    // Surface the failure to the acting client so a rejected join isn't silent.
    socket.emit("gameError", {
      action: "join",
      message: err instanceof Error ? err.message : "Could not join the game.",
    });
  }
};

/**
 * Handle a request to leave a game that hasn't started. Removes the player and
 * tells everyone in the room (so the opponent sees they left).
 */
export const socketLeaveGame: SocketAPI = (socket, io) => async (body) => {
  try {
    const { auth, payload: gameId } = withAuth(z.string()).parse(body);
    const user = await resolveActor(socket.data?.sessionUser, auth);
    const game = await leaveGame(gameId, user);

    const { display } = await populateSafeUserInfo(user.userId);
    const abandoned = game.status === "done";
    io.to(gameId).emit("gamePlayersUpdated", game.players);
    io.to(gameId).emit("gameNotice", {
      message: abandoned ? `${display} left — the game is over.` : `${display} left the game.`,
    });
    await socket.leave(gameId);
    await socket.leave(userRoom(gameId, user.userId));
  } catch (err) {
    logSocketError(socket, err);
    socket.emit("gameError", {
      action: "leave",
      message: err instanceof Error ? err.message : "Could not leave the game.",
    });
  }
};

/**
 * Handle a request to start the game.
 */
export const socketStart: SocketAPI = (socket, io) => async (body) => {
  try {
    const { auth, payload: gameId } = withAuth(z.string()).parse(body);
    const user = await resolveActor(socket.data?.sessionUser, auth);
    sendViewUpdates(io, gameId, await startGame(gameId, user));
  } catch (err) {
    logSocketError(socket, err);
  }
};

/**
 * Handle a request to make a move in a game.
 */
export const socketMakeMove: SocketAPI = (socket, io) => async (body) => {
  try {
    const {
      auth,
      payload: { gameId, move },
    } = withAuth(zGameMakeMovePayload).parse(body);
    const user = await resolveActor(socket.data?.sessionUser, auth);
    const viewUpdates = await updateGame(gameId, user, move);
    sendViewUpdates(io, gameId, viewUpdates);
  } catch (err) {
    logSocketError(socket, err);
  }
};
