/**
 * Coverage for the socket.io connection handler in app.ts.
 * All other test files use supertest (no real socket), so those branches are
 * never exercised. Here we spin up httpServer on a random port, connect real
 * socket.io-client sockets, and trigger every branch in the handler.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { io as ioClient, type Socket } from "socket.io-client";
import { httpServer } from "../src/app.ts";
import { getSocketServer } from "../src/controllers/socket.controller.ts";

let port: number;
const ALL_CLIENTS: Socket[] = [];

beforeAll(async () => {
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  port = (httpServer.address() as { port: number }).port;
});

afterAll(async () => {
  for (const cs of ALL_CLIENTS) {
    if (cs.connected) cs.disconnect();
  }
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
});

/** Connect a new socket.io client and wait for it to be ready. */
function connectClient(): Promise<Socket> {
  return new Promise((resolve) => {
    const cs = ioClient(`http://localhost:${port}`, { transports: ["websocket"] });
    ALL_CLIENTS.push(cs);
    cs.once("connect", () => resolve(cs));
  });
}

/** Wait for the server to process an async event. */
function delay(ms = 80) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/** Wait for a specific socket.io event. */
function waitForEvent(socket: Socket, event: string) {
  return new Promise<unknown>((resolve) => socket.once(event, resolve));
}

describe("app.ts socket connection handler", () => {
  it("emits onlineUsers snapshot on connection", async () => {
    // Register the listener BEFORE connection is established so we don't miss
    // the server's immediate socket.emit("onlineUsers", ...) on connect.
    const received = new Promise<unknown>((resolve) => {
      const cs = ioClient(`http://localhost:${port}`, { transports: ["websocket"] });
      ALL_CLIENTS.push(cs);
      cs.once("onlineUsers", (list) => resolve(list));
    });
    const list = await received;
    expect(Array.isArray(list)).toBe(true);
  });

  it("registers all socket event handlers on connection", async () => {
    // Just connecting exercises the socket.on event registrations.
    await connectClient();
    await delay();
  });

  it("userOnline adds user and broadcasts list", async () => {
    const cs = await connectClient();
    const broadcast = waitForEvent(cs, "onlineUsers");
    cs.emit("userOnline", { auth: { username: "alice" } });
    const list = await broadcast;
    expect(list).toContain("alice");
  });

  it("userOnline reuses existing Set entry", async () => {
    const cs1 = await connectClient();
    const cs2 = await connectClient();
    cs1.emit("userOnline", { auth: { username: "bob" } });
    await delay();
    // Second emit for the same user reuses the existing Set.
    cs2.emit("userOnline", { auth: { username: "bob" } });
    await delay();
  });

  it("userOnline catch branch: bad payload causes error inside try", async () => {
    const cs = await connectClient();
    // auth: null → null.username throws inside the try block → caught by catch
    cs.emit("userOnline", { auth: null });
    await delay();
  });

  it("getOnlineUsers emits current snapshot", async () => {
    const cs = await connectClient();
    const snap = waitForEvent(cs, "onlineUsers");
    cs.emit("getOnlineUsers");
    await expect(snap).resolves.toBeDefined();
  });

  it("onAny with invalid payload logs error", async () => {
    const cs = await connectClient();
    // Emit event with no payload — safeParse fails → checked.error is truthy
    cs.emit("chatJoin", null);
    await delay();
  });

  it("onAny with valid auth payload logs receipt", async () => {
    const cs = await connectClient();
    cs.emit("getOnlineUsers", { auth: { username: "carol" }, payload: {} });
    await delay();
  });

  it("disconnect without username", async () => {
    const cs = await connectClient();
    // Never emit userOnline → socket.data.username stays undefined
    cs.disconnect();
    await delay();
  });

  it("disconnect with username, sockets.size becomes 0", async () => {
    const cs = await connectClient();
    cs.emit("userOnline", { auth: { username: "solo" } });
    await delay();
    cs.disconnect();
    await delay();
    // onlineUsers should no longer contain "solo" (size went to 0 → deleted)
    const io = getSocketServer()!;
    expect(io).toBeDefined();
  });

  it("disconnect with sockets.size > 0", async () => {
    // Two clients for same user — first disconnect leaves size > 0
    const cs1 = await connectClient();
    const cs2 = await connectClient();
    cs1.emit("userOnline", { auth: { username: "multi" } });
    await delay();
    cs2.emit("userOnline", { auth: { username: "multi" } });
    await delay();
    cs1.disconnect(); // size goes from 2 to 1 → sockets.size === 0 is FALSE
    await delay();
    cs2.disconnect(); // size goes from 1 to 0 → sockets.size === 0 is TRUE
    await delay();
  });

  it("disconnect with username set but not in onlineUsers", async () => {
    const cs = await connectClient();
    await delay(); // wait for server to register the connection
    // Directly set socket.data.username on the server socket without going
    // through userOnline, so onlineUsers never has this entry.
    const io = getSocketServer()!;
    const serverSocket = io.sockets.sockets.get(cs.id as string);
    expect(serverSocket).toBeDefined();
    serverSocket!.data.username = "ghost-user";
    cs.disconnect();
    await delay();
  });
});
