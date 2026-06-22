/* eslint no-console: "off" */

import { type GameServer, type GameServerSocket } from "../types.ts";

/**
 * The live Socket.io server, stored once at startup so REST controllers can
 * push real-time events (e.g. friend-request notifications) without holding a
 * socket reference of their own.
 */
let ioRef: GameServer | null = null;

/** Record the Socket.io server instance (called once from app.ts). */
export function setSocketServer(io: GameServer) {
  ioRef = io;
}

/** Get the Socket.io server instance, or null if it hasn't started yet. */
export function getSocketServer(): GameServer | null {
  return ioRef;
}

/**
 * Logs a socket error to the console
 */
export function logSocketError(socket: GameServerSocket, err: unknown) {
  if (err instanceof Error) {
    console.log(`ERR! [${socket.id}] error message: "${err.message}"`);
  } else {
    console.log(`ERR! [${socket.id}] unexpected error ${JSON.stringify(err)}`);
  }
}
