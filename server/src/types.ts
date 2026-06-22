import { type Server, type Socket, type DefaultEventsMap } from "socket.io";
import { type Request, type Response } from "express";
import {
  type ClientToServerEvents,
  type ServerToClientEvents,
  type TaggedGameView,
} from "@gamenite/shared";

export type SocketAPI = (
  socket: GameServerSocket,
  io: GameServer,
) => (payload: unknown) => Promise<void>;

export type RestAPI<R = unknown, P = { [key: string]: string }> = (
  req: Request<P, R | { error: string }, unknown>,
  res: Response<R | { error: string }>,
) => Promise<void>;

/**
 * Per-connection data stored on `socket.data`.
 *
 * - `sessionUser`: the session resolved once from the handshake cookie (cached
 *   as a promise so events that arrive before it settles await the same lookup).
 * - `username`: tracked for online-user counting and disconnect handling.
 */
export interface SocketData {
  sessionUser?: Promise<UserWithId | null>;
  username?: string;
}

export type GameServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  DefaultEventsMap,
  SocketData
>;
export type GameServerSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  DefaultEventsMap,
  SocketData
>;

export interface GameViewUpdates {
  watchers: TaggedGameView;
  players: { userId: string; view: TaggedGameView }[];
}

export interface UserWithId {
  userId: string;
  username: string;
}
