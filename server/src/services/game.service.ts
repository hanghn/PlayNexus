import {
  type GameInfo,
  type GameInvitationInfo,
  type GameKey,
  type SafeUserInfo,
  type TaggedGameView,
} from "@gamenite/shared";
import { createChat } from "./chat.service.ts";
import { populateSafeUserInfo } from "./user.service.ts";
import { type GameServicer } from "../games/gameServiceManager.ts";
import { nimGameService } from "../games/nim.ts";
import { guessGameService } from "../games/guess.ts";
import { type GameViewUpdates, type UserWithId } from "../types.ts";
import { GameRepo, UserRepo } from "../repository.ts";
import { cribbageGameService } from "../games/cribbage.ts";
import { AI_EASY_PLAYER_ID, AI_HARD_PLAYER_ID, aiMoveFor } from "../games/cribbageAI.ts";
import { withKeyedLock } from "../lock.ts";

/** SafeUserInfo stubs returned for AI players (never stored in UserRepo). */
const aiEasySafeUser: SafeUserInfo = {
  username: AI_EASY_PLAYER_ID,
  display: "AI (Easy)",
  createdAt: new Date(0),
};
const aiHardSafeUser: SafeUserInfo = {
  username: AI_HARD_PLAYER_ID,
  display: "AI (Hard)",
  createdAt: new Date(0),
};
const aiStubs: Record<string, SafeUserInfo> = {
  [AI_EASY_PLAYER_ID]: aiEasySafeUser,
  [AI_HARD_PLAYER_ID]: aiHardSafeUser,
};
const isAIPlayer = (id: string): boolean => id in aiStubs;

/** Populate a player slot — handles the AI sentinels without hitting UserRepo. */
async function populatePlayerInfo(userId: string): Promise<SafeUserInfo> {
  if (aiStubs[userId]) return aiStubs[userId];
  return populateSafeUserInfo(userId);
}

/**
 * The service interface for individual games
 */
export const gameServices: { [key in GameKey]: GameServicer } = {
  nim: nimGameService,
  guess: guessGameService,
  cribbage: cribbageGameService,
};

/**
 * Expand a stored game
 *
 * @param gameId - Valid game id
 * @returns the expanded game info object
 */
async function populateGameInfo(gameId: string): Promise<GameInfo> {
  const game = await GameRepo.get(gameId);
  return {
    gameId,
    createdBy: await populatePlayerInfo(game.createdBy),
    chat: game.chat,
    createdAt: new Date(game.createdAt),
    players: await Promise.all(game.players.map(populatePlayerInfo)),
    type: game.type,
    status: !game.state ? "waiting" : game.done ? "done" : "active",
    minPlayers: gameServices[game.type].minPlayers,
  };
}

/**
 * Create and store a new game.
 *
 * When `singlePlayer` is true (cribbage only), the AI sentinel is added as
 * player 2 and the game is started immediately — no waiting room needed.
 *
 * @param user - Initial (human) player
 * @param type - Game key
 * @param createdAt - Creation time for this game
 * @param singlePlayer - If true, pair with Easy AI and auto-start
 * @returns the new game's info object
 */
export async function createGame(
  user: UserWithId,
  type: GameKey,
  createdAt: Date,
  singlePlayer?: boolean,
  difficulty?: "easy" | "hard",
): Promise<GameInfo> {
  const chat = await createChat(createdAt);

  const aiId = difficulty === "hard" ? AI_HARD_PLAYER_ID : AI_EASY_PLAYER_ID;
  const players = singlePlayer ? [user.userId, aiId] : [user.userId];

  const gameId = await GameRepo.add({
    type,
    done: false,
    chat: chat.chatId,
    createdAt: createdAt.toISOString(),
    createdBy: user.userId,
    players,
    singlePlayer: singlePlayer ?? false,
  });

  // Auto-start the game when playing solo so the caller gets a live view
  if (singlePlayer) {
    const game = await GameRepo.get(gameId);
    const { state } = gameServices[type].create(players);
    game.state = state;
    await GameRepo.set(gameId, game);
    // Let AI take its first moves (e.g. "ready" in the deal phase)
    await applyAIMoves(gameId);
  }

  return populateGameInfo(gameId);
}

/**
 * Retrieves a single game from the database. If you expect the id to be valid, use `forceGameById`.
 *
 * @param gameId - Ostensible game id
 * @returns the game's info object, or null
 */
export async function getGameById(gameId: string): Promise<GameInfo | null> {
  const game = await GameRepo.find(gameId);
  if (!game) return null;
  return populateGameInfo(gameId);
}

/**
 * Adds a user to a game that hasn't started yet. If the resulting game object has the maximum
 * allowed number of players, it is the responsibility of the caller to start the game.
 *
 * @param gameId - Ostensible game id
 * @param user - Authenticated user
 * @returns the game's info object, with the `user` listed among the players
 * @throws if the game id is not valid, if the game has started, or if the game cannot accept more
 * players
 */
export async function joinGame(gameId: string, user: UserWithId): Promise<GameInfo> {
  const game = await GameRepo.find(gameId);
  if (!game) throw new Error(`user ${user.username} joining invalid game`);
  if (game.state) {
    throw new Error(`user ${user.username} joining game that started`);
  }
  if (game.players.some((userId) => userId === user.userId)) {
    throw new Error(`user ${user.username} joining game they are in already`);
  }
  if (game.players.length === gameServices[game.type].maxPlayers) {
    throw new Error(`user ${user.username} joining full`);
  }

  game.players = [...game.players, user.userId];
  await GameRepo.set(gameId, game);

  return populateGameInfo(gameId);
}

/* ------------------------------ Game invitations ------------------------------
 * Pending invitations are kept in memory (they're short-lived by nature). This
 * lets a recipient who was offline when invited still see the invite when they
 * log in. Stale invites (game gone / started / already joined) are pruned on read.
 */
const pendingInvites = new Map<string, GameInvitationInfo>();
const inviteKey = (gameId: string, toUsername: string) => `${gameId}::${toUsername}`;

/** Record a pending invitation so an offline recipient can see it on login. */
export function storeInvitation(info: GameInvitationInfo): void {
  pendingInvites.set(inviteKey(info.gameId, info.toUsername), info);
}

/** Forget an invitation (e.g. after it's declined). */
export function removeInvitation(gameId: string, toUsername: string): void {
  pendingInvites.delete(inviteKey(gameId, toUsername));
}

/** The still-valid pending invitations addressed to a user. */
export async function getInvitationsForUser(username: string): Promise<GameInvitationInfo[]> {
  const result: GameInvitationInfo[] = [];
  for (const info of pendingInvites.values()) {
    if (info.toUsername !== username) continue;
    const game = await getGameById(info.gameId);
    // Drop invites that no longer make sense to act on.
    if (!game || game.status !== "waiting" || game.players.some((p) => p.username === username)) {
      pendingInvites.delete(inviteKey(info.gameId, info.toUsername));
      continue;
    }
    result.push(info);
  }
  return result;
}

/**
 * A player leaves a game. From a not-started lobby they're simply removed; from
 * an in-progress game, leaving abandons it (the game is marked done) so it stops
 * cluttering the live list and the opponent is freed up.
 *
 * @throws if the game is invalid or the user isn't a player
 */
export async function leaveGame(gameId: string, user: UserWithId): Promise<GameInfo> {
  const game = await GameRepo.find(gameId);
  if (!game) throw new Error(`user ${user.username} leaving invalid game`);
  if (!game.players.some((id) => id === user.userId)) {
    throw new Error(`user ${user.username} is not in this game`);
  }

  if (game.state && !game.done) {
    game.done = true; // in progress → abandon the game
  } else if (!game.state) {
    game.players = game.players.filter((id) => id !== user.userId); // lobby → just leave
  }
  await GameRepo.set(gameId, game);

  return populateGameInfo(gameId);
}

/**
 * Initializes a game that hasn't started yet
 *
 * @param gameId - Ostensible game id
 * @param user - Authenticated user
 * @returns the necessary views for everyone watching the game
 * @throws if the game id is not valid, if the game already started, or if the game lacks enough
 * players to start
 */
export async function startGame(gameId: string, user: UserWithId): Promise<GameViewUpdates> {
  const game = await GameRepo.find(gameId);
  if (!game) throw new Error(`user ${user.username} starting invalid game`);
  if (game.state) {
    throw new Error(`user ${user.username} starting game that started`);
  }

  const key: GameKey = game.type;

  if (game.players.length < gameServices[key].minPlayers) {
    throw new Error(`user ${user.username} starting underpopulated game`);
  }
  if (!game.players.some((userId) => userId === user.userId)) {
    throw new Error(`user ${user.username} starting game they're not in`);
  }
  const { state, views } = gameServices[key].create(game.players);

  game.state = state;
  await GameRepo.set(gameId, game);

  return views;
}

/**
 * Get a list of all games
 *
 * Fetches all games and their players in two batched queries (rather than
 * one per game/player) to keep the listing fast.
 *
 * @returns a list of game summaries, ordered reverse chronologically
 */
/** Cap on how many (most recent) games the list endpoint returns. The full
 *  history grows without bound, and fetching all of it times out small
 *  instances; the lobby and "recent games" only ever need the latest few. */
const MAX_GAMES_LISTED = 100;

export async function getGames(): Promise<GameInfo[]> {
  // 1 request: fetch only the most recent games (DB-ordered + limited).
  const games = await GameRepo.recentEntries(MAX_GAMES_LISTED);
  if (games.length === 0) return [];

  // Every *real* user id referenced across these games, deduped (exclude AI sentinel).
  const allIds = [...new Set(games.flatMap(({ value }) => [value.createdBy, ...value.players]))];
  const realIds = allIds.filter((id) => !isAIPlayer(id));

  // 1 request: fetch those users, then index them by id.
  const users = await UserRepo.getMany(realIds);
  const userById = new Map<string, SafeUserInfo>(
    realIds.map((id, i) => [
      id,
      {
        username: users[i].username,
        display: users[i].display,
        createdAt: new Date(users[i].createdAt),
      },
    ]),
  );
  // Inject the AI stubs so downstream .get() calls work uniformly.
  userById.set(AI_EASY_PLAYER_ID, aiEasySafeUser);
  userById.set(AI_HARD_PLAYER_ID, aiHardSafeUser);

  // recentEntries already returns games newest-first.
  return games.map(
    ({ key, value }): GameInfo => ({
      gameId: key,
      type: value.type,
      status: !value.state ? "waiting" : value.done ? "done" : "active",
      chat: value.chat,
      players: value.players.map((id) => userById.get(id)!),
      createdAt: new Date(value.createdAt),
      createdBy: userById.get(value.createdBy)!,
      minPlayers: gameServices[value.type].minPlayers,
    }),
  );
}

/**
 * Updates a game state and returns the necessary view updates
 *
 * @param gameId - Ostensible game id
 * @param user - Authenticated user
 * @param move - Unsanitized game move
 * @returns the view updates to send to players and watchers
 * @throws if the game id or move is not valid
 */
export async function updateGame(gameId: string, user: UserWithId, move: unknown) {
  // Serialize moves on this game so two near-simultaneous moves don't both read
  // the same state and have the second write clobber the first (lost update on
  // the read-modify-write below). The AI follow-up runs outside the lock to
  // avoid re-entering it (applyAIMoves does its own read-modify-write).
  const { result, singlePlayer, done } = await withKeyedLock(`game:${gameId}`, async () => {
    const game = await GameRepo.find(gameId);
    if (!game) throw new Error(`user ${user.username} acted on an invalid game`);
    if (!game.state) {
      throw new Error(`user ${user.username} made a move in game of that hadn't started`);
    }
    const playerIndex = game.players.findIndex((userId) => userId === user.userId);
    if (playerIndex < 0) {
      throw new Error(`user ${user.username} made a move in a game they weren't playing`);
    }
    const moveResult = gameServices[game.type].update(game.state, move, playerIndex, game.players);
    if (!moveResult) throw new Error(`user ${user.username} made an invalid move in ${game.type}`);

    game.state = moveResult.state;
    game.done = game.done || moveResult.done;
    await GameRepo.set(gameId, game);
    return { result: moveResult, singlePlayer: game.singlePlayer, done: game.done };
  });

  // In single-player mode, let the AI respond immediately after the human moves.
  // We return the AI's final views so the socket layer broadcasts them, overwriting
  // the intermediate state the human's own move produced.
  if (singlePlayer && !done) {
    const aiViews = await applyAIMoves(gameId);
    if (aiViews) return aiViews;
  }

  return result.views;
}

/**
 * View a game as a specific user
 * @param gameId - Ostensible game id
 * @param user - Authenticated user
 * @returns A boolean for whether that user is a player, the player's view, and the list of players
 */
export async function viewGame(gameId: string, user: UserWithId) {
  const game = await GameRepo.find(gameId);
  if (!game) throw new Error(`user ${user.username} viewed an invalid game id`);
  const playerIndex = game.players.findIndex((userId) => userId === user.userId);
  let view: TaggedGameView | null = null;
  if (game.state) {
    view = gameServices[game.type].view(game.state, playerIndex);
  }
  return {
    isPlayer: playerIndex >= 0,
    view,
    players: await Promise.all(game.players.map(populatePlayerInfo)),
  };
}

/**
 * If the game is a single-player cribbage game, keep applying AI moves until
 * the AI has nothing to do (returns null) or the game is over.
 *
 * This is called:
 *  1. Right after `createGame` auto-starts the board (AI sends "ready")
 *  2. At the end of `updateGame` after a human move
 *
 * Returns the final set of view updates produced by the AI's last move, or
 * null if the AI had nothing to do.
 */
export async function applyAIMoves(gameId: string): Promise<GameViewUpdates | null> {
  const game = await GameRepo.find(gameId);
  if (!game || !game.singlePlayer || !game.state || game.done) return null;

  const aiId = game.players.find(isAIPlayer);
  const aiIndex = aiId ? game.players.indexOf(aiId) : -1;
  if (!aiId || aiIndex < 0) return null;

  // Build the AI's view so we can decide what move to make
  const tagged = gameServices[game.type].view(game.state, aiIndex);
  if (tagged.type !== "cribbage") return null;

  const move = aiMoveFor(aiId, tagged.view);
  if (!move) return null;

  // Apply the move (same as updateGame but without the auth check)
  const result = gameServices[game.type].update(game.state, move, aiIndex, game.players);
  if (!result) return null;

  game.state = result.state;
  game.done = game.done || result.done;
  await GameRepo.set(gameId, game);

  // Recurse: the AI may need to act multiple times in a row
  // (e.g. both ready flags in quick succession on a fresh deal)
  const further = await applyAIMoves(gameId);
  return further ?? result.views;
}
