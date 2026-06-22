import { afterEach, describe, expect, it, vi } from "vitest";
import type { GameServer, GameServerSocket } from "../src/types.ts";
import { logSocketError } from "../src/controllers/socket.controller.ts";
import {
  socketJoin,
  socketLeave,
  socketSendMessage,
  socketDeleteMessage,
} from "../src/controllers/dm.controller.ts";
import { getUserByUsername } from "../src/services/auth.service.ts";
import { openDMThread, sendDMMessage } from "../src/services/dm.service.ts";

// Mock logSocketError so we can assert error paths without noisy logs / crashes.
vi.mock(import("../src/controllers/socket.controller.ts"), () => ({
  logSocketError: vi.fn(),
}));

// Minimal io/socket stand-ins: `to()` chains back so `io.to(room).emit(...)`
// records onto the shared `emit` mock.
const MockIo = vi.fn(
  class {
    to = vi.fn(() => this);
    emit = vi.fn();
  },
);
const MockSocket = vi.fn(
  class {
    id = "mockSocket";
    data = {};
    join = vi.fn();
    leave = vi.fn();
    emit = vi.fn();
    to = vi.fn(() => this);
  },
);

// Bob's seeded credentials; the controller resolves the actor from this token.
const bobAuth = { username: "bob", password: "cribbage-rematch" };

afterEach(() => vi.clearAllMocks());

async function bobDorisThreadId(): Promise<string> {
  const bob = (await getUserByUsername("bob"))!;
  const t = await openDMThread(bob, "doris");
  if ("error" in t) throw new Error(t.error);
  return t.threadId;
}

const emittedEvents = (io: GameServer): unknown[] =>
  (io.emit as unknown as { mock: { calls: unknown[][] } }).mock.calls.map((c) => c[0]);

describe("dm.controller socket handlers", () => {
  it("dmSendMessage broadcasts to the thread room and notifies the recipient", async () => {
    const threadId = await bobDorisThreadId();
    const io = new MockIo() as unknown as GameServer;
    const socket = new MockSocket() as unknown as GameServerSocket;

    await socketSendMessage(socket, io)({ auth: bobAuth, payload: { threadId, text: "yo" } });

    expect(io.to).toHaveBeenCalledWith(`dm:${threadId}`);
    expect(io.to).toHaveBeenCalledWith("user:doris");
    expect(emittedEvents(io)).toEqual(expect.arrayContaining(["dmNewMessage", "dmNotification"]));
    expect(logSocketError).not.toHaveBeenCalled();
  });

  it("dmSendMessage logs an error for an unknown thread and emits nothing", async () => {
    const io = new MockIo() as unknown as GameServer;
    const socket = new MockSocket() as unknown as GameServerSocket;

    await socketSendMessage(
      socket,
      io,
    )({
      auth: bobAuth,
      payload: { threadId: "missing", text: "x" },
    });

    expect(logSocketError).toHaveBeenCalled();
    expect(io.emit).not.toHaveBeenCalled();
  });

  it("dmJoin subscribes a participant to the thread room", async () => {
    const threadId = await bobDorisThreadId();
    const io = new MockIo() as unknown as GameServer;
    const socket = new MockSocket() as unknown as GameServerSocket;

    await socketJoin(socket, io)({ auth: bobAuth, payload: threadId });

    expect(socket.join).toHaveBeenCalledWith(`dm:${threadId}`);
  });

  it("dmJoin logs an error when the caller isn't a participant", async () => {
    const io = new MockIo() as unknown as GameServer;
    const socket = new MockSocket() as unknown as GameServerSocket;

    await socketJoin(socket, io)({ auth: bobAuth, payload: "not-a-thread" });

    expect(socket.join).not.toHaveBeenCalled();
    expect(logSocketError).toHaveBeenCalled();
  });

  it("dmLeave unsubscribes from the thread room", async () => {
    const threadId = await bobDorisThreadId();
    const io = new MockIo() as unknown as GameServer;
    const socket = new MockSocket() as unknown as GameServerSocket;

    await socketLeave(socket, io)({ auth: bobAuth, payload: threadId });

    expect(socket.leave).toHaveBeenCalledWith(`dm:${threadId}`);
  });

  it("dmDeleteMessage broadcasts a deletion for your own message", async () => {
    const bob = (await getUserByUsername("bob"))!;
    const threadId = await bobDorisThreadId();
    const sent = await sendDMMessage(threadId, bob, "to delete");
    if ("error" in sent) throw new Error(sent.error);
    const messageId = sent.messages.at(-1)!.messageId;

    const io = new MockIo() as unknown as GameServer;
    const socket = new MockSocket() as unknown as GameServerSocket;

    await socketDeleteMessage(socket, io)({ auth: bobAuth, payload: { threadId, messageId } });

    expect(io.to).toHaveBeenCalledWith(`dm:${threadId}`);
    expect(emittedEvents(io)).toContain("dmMessageDeleted");
  });

  it("dmDeleteMessage logs an error when deleting someone else's message", async () => {
    const doris = (await getUserByUsername("doris"))!;
    const threadId = await bobDorisThreadId();
    const sent = await sendDMMessage(threadId, doris, "doris message");
    if ("error" in sent) throw new Error(sent.error);
    const messageId = sent.messages.at(-1)!.messageId;

    const io = new MockIo() as unknown as GameServer;
    const socket = new MockSocket() as unknown as GameServerSocket;

    await socketDeleteMessage(socket, io)({ auth: bobAuth, payload: { threadId, messageId } });

    expect(logSocketError).toHaveBeenCalled();
    expect(io.emit).not.toHaveBeenCalled();
  });

  it("dmSendMessage logs an error when the token is invalid", async () => {
    const threadId = await bobDorisThreadId();
    const io = new MockIo() as unknown as GameServer;
    const socket = new MockSocket() as unknown as GameServerSocket;

    await socketSendMessage(
      socket,
      io,
    )({
      auth: { username: "bob", password: "wrong" },
      payload: { threadId, text: "hi" },
    });

    expect(logSocketError).toHaveBeenCalled();
    expect(io.emit).not.toHaveBeenCalled();
  });

  it("dmLeave logs an error on invalid auth and doesn't leave", async () => {
    const io = new MockIo() as unknown as GameServer;
    const socket = new MockSocket() as unknown as GameServerSocket;

    await socketLeave(
      socket,
      io,
    )({
      auth: { username: "bob", password: "wrong" },
      payload: "some-thread",
    });

    expect(socket.leave).not.toHaveBeenCalled();
    expect(logSocketError).toHaveBeenCalled();
  });
});
