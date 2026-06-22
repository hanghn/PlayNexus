import { afterEach, describe, expect, it, vi } from "vitest";
import type { GameServer, GameServerSocket } from "../src/types.ts";
import { logSocketError } from "../src/controllers/socket.controller.ts";
import {
  socketWatch,
  socketJoinAsPlayer,
  socketLeaveGame,
  socketStart,
  socketMakeMove,
} from "../src/controllers/game.controller.ts";
import { createGame, joinGame, startGame } from "../src/services/game.service.ts";
import { getUserByUsername } from "../src/services/auth.service.ts";

vi.mock(import("../src/controllers/socket.controller.ts"), () => ({
  logSocketError: vi.fn(),
}));

const user0 = { username: "user0", password: "pwd0000" };
const user1 = { username: "user1", password: "pwd1111" };

function makeSocket(): GameServerSocket {
  const socket = {
    id: "s",
    data: {},
    rooms: new Set<string>(),
    join: vi.fn(),
    leave: vi.fn(),
    emit: vi.fn(),
    to: vi.fn(() => socket),
  };
  return socket as unknown as GameServerSocket;
}

function makeIo(): GameServer {
  const io = { to: vi.fn(() => io), emit: vi.fn() };
  return io as unknown as GameServer;
}

const events = (m: { emit: unknown }): unknown[] =>
  (m.emit as { mock: { calls: unknown[][] } }).mock.calls.map((c) => c[0]);

/** A 2-player Nim game with `user0` and `user1` joined. */
async function twoPlayerNim(): Promise<string> {
  const u0 = (await getUserByUsername("user0"))!;
  const u1 = (await getUserByUsername("user1"))!;
  const game = await createGame(u0, "nim", new Date());
  await joinGame(game.gameId, u1);
  return game.gameId;
}

afterEach(() => vi.clearAllMocks());

describe("game.controller socket handlers", () => {
  it("socketWatch joins the room and emits gameWatched", async () => {
    const u0 = (await getUserByUsername("user0"))!;
    const game = await createGame(u0, "nim", new Date());
    const socket = makeSocket();
    await socketWatch(socket, makeIo())({ auth: user0, payload: game.gameId });
    expect(socket.join).toHaveBeenCalled();
    expect(events(socket)).toContain("gameWatched");
  });

  it("socketWatch logs an error for an invalid game", async () => {
    const socket = makeSocket();
    await socketWatch(socket, makeIo())({ auth: user0, payload: "missing" });
    expect(logSocketError).toHaveBeenCalled();
  });

  it("logs an error when the socket token is invalid (no actor resolves)", async () => {
    await socketWatch(
      makeSocket(),
      makeIo(),
    )({
      auth: { username: "user0", password: "wrong" },
      payload: "x",
    });
    expect(logSocketError).toHaveBeenCalled();
  });

  it("socketJoinAsPlayer broadcasts the updated players (and auto-starts when full)", async () => {
    const u0 = (await getUserByUsername("user0"))!;
    const game = await createGame(u0, "nim", new Date());
    const socket = makeSocket();
    const io = makeIo();
    await socketJoinAsPlayer(socket, io)({ auth: user1, payload: game.gameId });
    expect(events(io)).toContain("gamePlayersUpdated");
    // nim seats two, so joining filled it and started the game
    expect(events(io)).toContain("gameStateUpdated");
  });

  it("socketWatch joins only the game room for a non-player watcher", async () => {
    const u0 = (await getUserByUsername("user0"))!;
    const game = await createGame(u0, "nim", new Date());
    const socket = makeSocket();
    await socketWatch(
      socket,
      makeIo(),
    )({
      auth: { username: "user2", password: "pwd2222" },
      payload: game.gameId,
    });
    expect(events(socket)).toContain("gameWatched");
  });

  it("socketJoinAsPlayer doesn't auto-start a game that still has open seats", async () => {
    const u0 = (await getUserByUsername("user0"))!;
    const game = await createGame(u0, "guess", new Date()); // guess allows many players
    const io = makeIo();
    await socketJoinAsPlayer(makeSocket(), io)({ auth: user1, payload: game.gameId });
    expect(events(io)).toContain("gamePlayersUpdated");
    expect(events(io)).not.toContain("gameStateUpdated");
  });

  it("socketWatch falls back to the socket's session user when no token resolves", async () => {
    const u0 = (await getUserByUsername("user0"))!;
    const game = await createGame(u0, "nim", new Date());
    const socket = makeSocket();
    (socket.data as { sessionUser?: unknown }).sessionUser = u0;
    await socketWatch(
      socket,
      makeIo(),
    )({
      auth: { username: "ghost", password: "x" },
      payload: game.gameId,
    });
    expect(events(socket)).toContain("gameWatched");
  });

  it("socketJoinAsPlayer skips re-joining the user room when already in it", async () => {
    const u0 = (await getUserByUsername("user0"))!;
    const u1 = (await getUserByUsername("user1"))!;
    const game = await createGame(u0, "nim", new Date());
    const socket = makeSocket();
    socket.rooms.add(`${game.gameId}-${u1.userId}`); // already subscribed
    await socketJoinAsPlayer(socket, makeIo())({ auth: user1, payload: game.gameId });
    expect(socket.join).not.toHaveBeenCalledWith(`${game.gameId}-${u1.userId}`);
  });

  it("socketJoinAsPlayer reports a gameError when the join fails", async () => {
    const socket = makeSocket();
    await socketJoinAsPlayer(socket, makeIo())({ auth: user0, payload: "missing" });
    expect(logSocketError).toHaveBeenCalled();
    expect(events(socket)).toContain("gameError");
  });

  it("socketLeaveGame broadcasts players and a notice, and leaves the rooms", async () => {
    const gameId = await twoPlayerNim();
    const socket = makeSocket();
    const io = makeIo();
    await socketLeaveGame(socket, io)({ auth: user0, payload: gameId });
    expect(events(io)).toEqual(expect.arrayContaining(["gamePlayersUpdated", "gameNotice"]));
    expect(socket.leave).toHaveBeenCalled();
  });

  it("socketLeaveGame abandons an in-progress game", async () => {
    const u0 = (await getUserByUsername("user0"))!;
    const gameId = await twoPlayerNim();
    await startGame(gameId, u0);
    const io = makeIo();
    await socketLeaveGame(makeSocket(), io)({ auth: user0, payload: gameId });
    expect(events(io)).toContain("gameNotice");
  });

  it("socketLeaveGame reports a gameError when leaving fails", async () => {
    const socket = makeSocket();
    await socketLeaveGame(socket, makeIo())({ auth: user0, payload: "missing" });
    expect(logSocketError).toHaveBeenCalled();
    expect(events(socket)).toContain("gameError");
  });

  it("socketStart broadcasts the started game's views", async () => {
    const gameId = await twoPlayerNim();
    const io = makeIo();
    await socketStart(makeSocket(), io)({ auth: user0, payload: gameId });
    expect(events(io)).toContain("gameStateUpdated");
  });

  it("socketStart logs an error for an invalid game", async () => {
    await socketStart(makeSocket(), makeIo())({ auth: user0, payload: "missing" });
    expect(logSocketError).toHaveBeenCalled();
  });

  it("socketMakeMove applies a move and broadcasts the new views", async () => {
    const u0 = (await getUserByUsername("user0"))!;
    const gameId = await twoPlayerNim();
    await startGame(gameId, u0);
    const io = makeIo();
    await socketMakeMove(makeSocket(), io)({ auth: user0, payload: { gameId, move: 1 } });
    expect(events(io)).toContain("gameStateUpdated");
  });

  it("socketMakeMove logs an error for an illegal move", async () => {
    const u0 = (await getUserByUsername("user0"))!;
    const gameId = await twoPlayerNim();
    await startGame(gameId, u0);
    await socketMakeMove(makeSocket(), makeIo())({ auth: user0, payload: { gameId, move: 999 } });
    expect(logSocketError).toHaveBeenCalled();
  });
});
