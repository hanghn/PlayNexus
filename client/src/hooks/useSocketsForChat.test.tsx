// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const useLoginContext = vi.fn();
const useAuth = vi.fn();

vi.mock("./useLoginContext.ts", () => ({
  default: () => useLoginContext(),
}));

vi.mock("./useAuth.ts", () => ({
  default: () => useAuth(),
}));

import useSocketsForChat from "./useSocketsForChat.ts";

type Handler = (...args: unknown[]) => void;

/**
 * Minimal Socket.IO stand-in. `on`/`off` manage handlers; `trigger` invokes the
 * registered listeners for an event (simulating an inbound server broadcast),
 * while `emit` is just a spy for outbound messages.
 */
function makeSocket() {
  const handlers: Record<string, Handler[]> = {};
  return {
    on: vi.fn((event: string, cb: Handler) => {
      (handlers[event] ??= []).push(cb);
    }),
    off: vi.fn((event: string, cb: Handler) => {
      handlers[event] = (handlers[event] ?? []).filter((h) => h !== cb);
    }),
    emit: vi.fn(),
    trigger: (event: string, payload: unknown) =>
      (handlers[event] ?? []).forEach((h) => h(payload)),
    handlers,
  };
}

const auth = { username: "me", password: "pw" };
const user = { username: "me", displayName: "Me" };

beforeEach(() => {
  vi.clearAllMocks();
  useAuth.mockReturnValue(auth);
});

describe("useSocketsForChat", () => {
  it("emits chatJoin and subscribes to chatJoined on mount", () => {
    const socket = makeSocket();
    useLoginContext.mockReturnValue({ socket, user });

    const { result } = renderHook(() => useSocketsForChat("c1"));

    expect(result.current.messages).toBeNull();
    expect(socket.emit).toHaveBeenCalledWith("chatJoin", { auth, payload: "c1" });
    expect(socket.on).toHaveBeenCalledWith("chatJoined", expect.any(Function));
  });

  it("populates messages and wires up listeners when the matching chat is joined", () => {
    const socket = makeSocket();
    useLoginContext.mockReturnValue({ socket, user });

    const { result } = renderHook(() => useSocketsForChat("c1"));

    act(() => {
      socket.trigger("chatJoined", {
        chatId: "c1",
        messages: [{ messageId: "m1", text: "hi" }],
      });
    });

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages?.[0]).toEqual({ messageId: "m1", text: "hi" });
    expect(result.current.messages?.[1]).toMatchObject({ meta: "entered", user });

    // The join handler unsubscribes itself and subscribes to the live events.
    expect(socket.off).toHaveBeenCalledWith("chatJoined", expect.any(Function));
    expect(socket.on).toHaveBeenCalledWith("chatNewMessage", expect.any(Function));
    expect(socket.on).toHaveBeenCalledWith("chatUserJoined", expect.any(Function));
    expect(socket.on).toHaveBeenCalledWith("chatMessageDeleted", expect.any(Function));
  });

  it("ignores a chatJoined broadcast for a different chat", () => {
    const socket = makeSocket();
    useLoginContext.mockReturnValue({ socket, user });

    const { result } = renderHook(() => useSocketsForChat("c1"));

    act(() => {
      socket.trigger("chatJoined", { chatId: "other", messages: [] });
    });

    expect(result.current.messages).toBeNull();
  });

  it("appends a new message broadcast for the matching chat", () => {
    const socket = makeSocket();
    useLoginContext.mockReturnValue({ socket, user });

    const { result } = renderHook(() => useSocketsForChat("c1"));
    act(() => {
      socket.trigger("chatJoined", {
        chatId: "c1",
        messages: [{ messageId: "m1", text: "hi" }],
      });
    });

    act(() => {
      socket.trigger("chatNewMessage", {
        chatId: "c1",
        message: { messageId: "m2", text: "yo" },
      });
    });

    expect(result.current.messages).toContainEqual({ messageId: "m2", text: "yo" });

    // A new message for a different chat is a no-op.
    const before = result.current.messages?.length;
    act(() => {
      socket.trigger("chatNewMessage", {
        chatId: "other",
        message: { messageId: "mX", text: "nope" },
      });
    });
    expect(result.current.messages?.length).toBe(before);
  });

  it("appends a meta entry when another user joins the matching chat", () => {
    const socket = makeSocket();
    useLoginContext.mockReturnValue({ socket, user });

    const { result } = renderHook(() => useSocketsForChat("c1"));
    act(() => {
      socket.trigger("chatJoined", { chatId: "c1", messages: [] });
    });

    const other = { username: "alice", displayName: "Alice" };
    act(() => {
      socket.trigger("chatUserJoined", { chatId: "c1", user: other });
    });

    expect(result.current.messages?.at(-1)).toMatchObject({ meta: "entered", user: other });

    // A join for a different chat is a no-op.
    const before = result.current.messages?.length;
    act(() => {
      socket.trigger("chatUserJoined", { chatId: "other", user: other });
    });
    expect(result.current.messages?.length).toBe(before);
  });

  it("removes a deleted message for the matching chat and ignores others", () => {
    const socket = makeSocket();
    useLoginContext.mockReturnValue({ socket, user });

    const { result } = renderHook(() => useSocketsForChat("c1"));
    act(() => {
      socket.trigger("chatJoined", {
        chatId: "c1",
        messages: [
          { messageId: "m1", text: "hi" },
          { messageId: "m2", text: "bye" },
        ],
      });
    });

    act(() => {
      socket.trigger("chatMessageDeleted", { chatId: "c1", messageId: "m1" });
    });
    expect(result.current.messages).not.toContainEqual({ messageId: "m1", text: "hi" });
    expect(result.current.messages).toContainEqual({ messageId: "m2", text: "bye" });

    const before = result.current.messages?.length;
    act(() => {
      socket.trigger("chatMessageDeleted", { chatId: "other", messageId: "m2" });
    });
    expect(result.current.messages?.length).toBe(before);
  });

  it("handleMessageCreation emits a chatSendMessage event", () => {
    const socket = makeSocket();
    useLoginContext.mockReturnValue({ socket, user });

    const { result } = renderHook(() => useSocketsForChat("c1"));

    act(() => result.current.handleMessageCreation("hello"));
    expect(socket.emit).toHaveBeenCalledWith("chatSendMessage", {
      auth,
      payload: { chatId: "c1", text: "hello" },
    });
  });

  it("deleteMessage emits a chatDeleteMessage event", () => {
    const socket = makeSocket();
    useLoginContext.mockReturnValue({ socket, user });

    const { result } = renderHook(() => useSocketsForChat("c1"));

    act(() => result.current.deleteMessage("m9"));
    expect(socket.emit).toHaveBeenCalledWith("chatDeleteMessage", {
      auth,
      payload: { chatId: "c1", messageId: "m9" },
    });
  });

  it("unsubscribes and leaves the chat on unmount", async () => {
    const socket = makeSocket();
    useLoginContext.mockReturnValue({ socket, user });

    const { unmount } = renderHook(() => useSocketsForChat("c1"));
    await waitFor(() => expect(socket.on).toHaveBeenCalled());

    unmount();
    expect(socket.off).toHaveBeenCalledWith("chatNewMessage", expect.any(Function));
    expect(socket.off).toHaveBeenCalledWith("chatUserJoined", expect.any(Function));
    expect(socket.off).toHaveBeenCalledWith("chatMessageDeleted", expect.any(Function));
    expect(socket.off).toHaveBeenCalledWith("chatJoined", expect.any(Function));
    expect(socket.emit).toHaveBeenCalledWith("chatLeave", { auth, payload: "c1" });
  });
});
