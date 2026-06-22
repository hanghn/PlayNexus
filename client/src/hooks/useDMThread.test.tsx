// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const getDMThread = vi.fn();
const useLoginContext = vi.fn();
const useAuth = vi.fn();

vi.mock("../services/dmService.ts", () => ({
  getDMThread: (...args: unknown[]) => getDMThread(...args),
}));

vi.mock("./useLoginContext.ts", () => ({
  default: () => useLoginContext(),
}));

vi.mock("./useAuth.ts", () => ({
  default: () => useAuth(),
}));

import useDMThread from "./useDMThread.ts";

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

function makeThread(threadId: string, messages: { messageId: string; text: string }[]) {
  return { threadId, participants: ["me", "alice"], messages };
}

beforeEach(() => {
  vi.clearAllMocks();
  useAuth.mockReturnValue(auth);
});

describe("useDMThread", () => {
  it("loads the thread history over REST on mount and joins the room", async () => {
    const socket = makeSocket();
    useLoginContext.mockReturnValue({ socket });
    const initial = makeThread("t1", [{ messageId: "m1", text: "hi" }]);
    getDMThread.mockResolvedValue(initial);

    const { result } = renderHook(() => useDMThread("t1"));

    expect(result.current.thread).toBeNull();
    expect(result.current.error).toBeNull();

    await waitFor(() => expect(result.current.thread).toEqual(initial));
    expect(getDMThread).toHaveBeenCalledWith(auth, "t1");
    expect(socket.emit).toHaveBeenCalledWith("dmJoin", { auth, payload: "t1" });
    expect(socket.on).toHaveBeenCalledWith("dmNewMessage", expect.any(Function));
    expect(socket.on).toHaveBeenCalledWith("dmMessageDeleted", expect.any(Function));
  });

  it("sets an error message when the initial load rejects", async () => {
    const socket = makeSocket();
    useLoginContext.mockReturnValue({ socket });
    getDMThread.mockRejectedValue(new Error("no access"));

    const { result } = renderHook(() => useDMThread("t1"));

    await waitFor(() => expect(result.current.error).toBe("Error: no access"));
    expect(result.current.thread).toBeNull();
  });

  it("appends a new message broadcast for the matching thread", async () => {
    const socket = makeSocket();
    useLoginContext.mockReturnValue({ socket });
    getDMThread.mockResolvedValue(makeThread("t1", [{ messageId: "m1", text: "hi" }]));

    const { result } = renderHook(() => useDMThread("t1"));
    await waitFor(() => expect(result.current.thread).not.toBeNull());

    act(() => {
      socket.trigger("dmNewMessage", {
        threadId: "t1",
        message: { messageId: "m2", text: "yo" },
      });
    });

    expect(result.current.thread?.messages).toEqual([
      { messageId: "m1", text: "hi" },
      { messageId: "m2", text: "yo" },
    ]);
  });

  it("ignores a new message broadcast for a different thread", async () => {
    const socket = makeSocket();
    useLoginContext.mockReturnValue({ socket });
    getDMThread.mockResolvedValue(makeThread("t1", [{ messageId: "m1", text: "hi" }]));

    const { result } = renderHook(() => useDMThread("t1"));
    await waitFor(() => expect(result.current.thread).not.toBeNull());

    act(() => {
      socket.trigger("dmNewMessage", {
        threadId: "other",
        message: { messageId: "mX", text: "nope" },
      });
    });

    expect(result.current.thread?.messages).toEqual([{ messageId: "m1", text: "hi" }]);
  });

  it("removes a deleted message for the matching thread", async () => {
    const socket = makeSocket();
    useLoginContext.mockReturnValue({ socket });
    getDMThread.mockResolvedValue(
      makeThread("t1", [
        { messageId: "m1", text: "hi" },
        { messageId: "m2", text: "bye" },
      ]),
    );

    const { result } = renderHook(() => useDMThread("t1"));
    await waitFor(() => expect(result.current.thread).not.toBeNull());

    act(() => {
      socket.trigger("dmMessageDeleted", { threadId: "t1", messageId: "m1" });
    });

    expect(result.current.thread?.messages).toEqual([{ messageId: "m2", text: "bye" }]);

    // A delete for a different thread is a no-op.
    act(() => {
      socket.trigger("dmMessageDeleted", { threadId: "other", messageId: "m2" });
    });
    expect(result.current.thread?.messages).toEqual([{ messageId: "m2", text: "bye" }]);
  });

  it("send() emits a trimmed message and ignores blank input", async () => {
    const socket = makeSocket();
    useLoginContext.mockReturnValue({ socket });
    getDMThread.mockResolvedValue(makeThread("t1", []));

    const { result } = renderHook(() => useDMThread("t1"));
    await waitFor(() => expect(result.current.thread).not.toBeNull());

    act(() => result.current.send("   "));
    expect(socket.emit).not.toHaveBeenCalledWith("dmSendMessage", expect.anything());

    act(() => result.current.send("  hello  "));
    expect(socket.emit).toHaveBeenCalledWith("dmSendMessage", {
      auth,
      payload: { threadId: "t1", text: "hello" },
    });
  });

  it("deleteMessage() emits a delete event", async () => {
    const socket = makeSocket();
    useLoginContext.mockReturnValue({ socket });
    getDMThread.mockResolvedValue(makeThread("t1", []));

    const { result } = renderHook(() => useDMThread("t1"));
    await waitFor(() => expect(result.current.thread).not.toBeNull());

    act(() => result.current.deleteMessage("m9"));
    expect(socket.emit).toHaveBeenCalledWith("dmDeleteMessage", {
      auth,
      payload: { threadId: "t1", messageId: "m9" },
    });
  });

  it("refresh() re-fetches the thread over REST", async () => {
    const socket = makeSocket();
    useLoginContext.mockReturnValue({ socket });
    const first = makeThread("t1", [{ messageId: "m1", text: "one" }]);
    const second = makeThread("t1", [{ messageId: "m2", text: "two" }]);
    getDMThread.mockResolvedValueOnce(first).mockResolvedValueOnce(second);

    const { result } = renderHook(() => useDMThread("t1"));
    await waitFor(() => expect(result.current.thread).toEqual(first));

    await act(async () => {
      result.current.refresh();
    });
    await waitFor(() => expect(result.current.thread).toEqual(second));
    expect(getDMThread).toHaveBeenCalledTimes(2);
  });

  it("leaves the room and unsubscribes on unmount", async () => {
    const socket = makeSocket();
    useLoginContext.mockReturnValue({ socket });
    getDMThread.mockResolvedValue(makeThread("t1", []));

    const { unmount } = renderHook(() => useDMThread("t1"));
    await waitFor(() => expect(socket.on).toHaveBeenCalled());

    unmount();
    expect(socket.off).toHaveBeenCalledWith("dmNewMessage", expect.any(Function));
    expect(socket.off).toHaveBeenCalledWith("dmMessageDeleted", expect.any(Function));
    expect(socket.emit).toHaveBeenCalledWith("dmLeave", { auth, payload: "t1" });
  });
});
