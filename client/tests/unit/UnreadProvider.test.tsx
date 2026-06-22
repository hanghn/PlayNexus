// @vitest-environment jsdom
import { act, renderHook, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import type { ReactNode } from "react";
import UnreadProvider from "../../src/components/UnreadProvider.tsx";
import useUnread from "../../src/hooks/useUnread.ts";

// A tiny fake socket that records handlers so the test can fire server events.
const h = vi.hoisted(() => {
  const handlers: Record<string, Set<(p: unknown) => void>> = {};
  const socket = {
    on(ev: string, fn: (p: unknown) => void) {
      (handlers[ev] ??= new Set()).add(fn);
    },
    off(ev: string, fn: (p: unknown) => void) {
      handlers[ev]?.delete(fn);
    },
  };
  return {
    socket,
    user: { username: "bob", display: "Bob" },
    fire(ev: string, payload: unknown) {
      [...(handlers[ev] ?? [])].forEach((fn) => fn(payload));
    },
    reset() {
      for (const k of Object.keys(handlers)) delete handlers[k];
    },
  };
});

vi.mock("../../src/hooks/useLoginContext.ts", () => ({
  default: () => ({ socket: h.socket, user: h.user, reset: () => undefined }),
}));

function dm(threadId: string, fromUsername: string) {
  return { threadId, from: { username: fromUsername, display: fromUsername } };
}

function wrapperAt(path: string) {
  return ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[path]}>
      <UnreadProvider>{children}</UnreadProvider>
    </MemoryRouter>
  );
}

beforeEach(() => h.reset());
afterEach(() => cleanup());

describe("UnreadProvider / useUnread", () => {
  it("starts with no unread and a zero total", () => {
    const { result } = renderHook(() => useUnread(), { wrapper: wrapperAt("/messages") });
    expect(result.current.counts).toEqual({});
    expect(result.current.total).toBe(0);
  });

  it("increments the count for the thread a message arrives in", () => {
    const { result } = renderHook(() => useUnread(), { wrapper: wrapperAt("/messages") });
    act(() => h.fire("dmNotification", dm("t1", "doris")));
    expect(result.current.counts.t1).toBe(1);
    expect(result.current.total).toBe(1);
  });

  it("keeps a separate count per sender and sums them in the total", () => {
    // This is the exact bug we hit: messages from several distinct new users
    // must each get their own badge, not collapse onto one row.
    const { result } = renderHook(() => useUnread(), { wrapper: wrapperAt("/messages") });
    act(() => {
      h.fire("dmNotification", dm("t-doris", "doris"));
      h.fire("dmNotification", dm("t-james", "james"));
      h.fire("dmNotification", dm("t-james", "james"));
    });
    expect(result.current.counts).toEqual({ "t-doris": 1, "t-james": 2 });
    expect(result.current.total).toBe(3);
  });

  it("accumulates repeated messages in the same thread", () => {
    const { result } = renderHook(() => useUnread(), { wrapper: wrapperAt("/messages") });
    act(() => {
      for (let i = 0; i < 5; i += 1) h.fire("dmNotification", dm("t1", "doris"));
    });
    expect(result.current.counts.t1).toBe(5);
  });

  it("ignores your own messages (shared-cookie cross-talk safety net)", () => {
    const { result } = renderHook(() => useUnread(), { wrapper: wrapperAt("/messages") });
    act(() => h.fire("dmNotification", dm("t1", "bob"))); // from === me
    expect(result.current.counts).toEqual({});
    expect(result.current.total).toBe(0);
  });

  it("still badges a message for the thread you're viewing (so the cue always shows)", () => {
    // The user explicitly wanted the unread cue even while on the Messages page.
    const { result } = renderHook(() => useUnread(), { wrapper: wrapperAt("/messages/t1") });
    act(() => h.fire("dmNotification", dm("t1", "doris")));
    expect(result.current.counts.t1).toBe(1);
  });

  it("markThreadRead clears one thread without touching the others", () => {
    const { result } = renderHook(() => useUnread(), { wrapper: wrapperAt("/messages") });
    act(() => {
      h.fire("dmNotification", dm("t1", "doris"));
      h.fire("dmNotification", dm("t2", "james"));
    });
    act(() => result.current.markThreadRead("t1"));
    expect(result.current.counts.t1).toBe(0);
    expect(result.current.counts.t2).toBe(1);
    expect(result.current.total).toBe(1);
  });

  it("markThreadRead on an unknown thread is a harmless no-op", () => {
    const { result } = renderHook(() => useUnread(), { wrapper: wrapperAt("/messages") });
    act(() => h.fire("dmNotification", dm("t1", "doris")));
    act(() => result.current.markThreadRead("does-not-exist"));
    expect(result.current.total).toBe(1);
  });

  it("stops counting after unmount (listener is cleaned up)", () => {
    const { result, unmount } = renderHook(() => useUnread(), { wrapper: wrapperAt("/messages") });
    act(() => h.fire("dmNotification", dm("t1", "doris")));
    const before = result.current.total;
    unmount();
    act(() => h.fire("dmNotification", dm("t1", "doris")));
    expect(result.current.total).toBe(before);
  });
});
