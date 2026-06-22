import { describe, it, expect, vi, afterEach } from "vitest";
import type { GameServer, GameServerSocket } from "../src/types.ts";
import {
  setSocketServer,
  getSocketServer,
  logSocketError,
} from "../src/controllers/socket.controller.ts";

const mockSocket = { id: "sock1" } as unknown as GameServerSocket;

afterEach(() => vi.restoreAllMocks());

describe("socket.controller", () => {
  it("stores and returns the Socket.io server instance", () => {
    const io = { tag: "io" } as unknown as GameServer;
    setSocketServer(io);
    expect(getSocketServer()).toBe(io);
  });

  it("logs an Error's message", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    logSocketError(mockSocket, new Error("boom"));
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("boom"));
  });

  it("logs a non-Error value", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    logSocketError(mockSocket, { weird: true });
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("unexpected error"));
  });
});
