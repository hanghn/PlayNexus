// @vitest-environment jsdom
import { act, renderHook, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import useSocialToasts from "../../src/hooks/useSocialToasts.ts";

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

// announce() touches no DOM here; stub it so the tests stay focused on toasts.
vi.mock("../../src/lib/liveAnnounce.ts", () => ({ announce: vi.fn() }));

function dm(threadId: string, fromUsername: string) {
  return { threadId, from: { username: fromUsername, display: fromUsername } };
}

function friendReq(friendshipId: string, fromUsername: string, toUsername: string) {
  return {
    friendshipId,
    status: "pending",
    from: { username: fromUsername, display: fromUsername },
    to: { username: toUsername, display: toUsername },
  };
}

beforeEach(() => h.reset());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("useSocialToasts", () => {
  it("adds a DM toast pointing at the thread", () => {
    const { result } = renderHook(() => useSocialToasts());
    act(() => h.fire("dmNotification", dm("t1", "doris")));
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0]).toMatchObject({
      kind: "dm",
      to: "/messages/t1",
    });
    expect(result.current.toasts[0].text).toContain("doris");
  });

  it("does not toast your own outgoing message", () => {
    const { result } = renderHook(() => useSocialToasts());
    act(() => h.fire("dmNotification", dm("t1", "bob")));
    expect(result.current.toasts).toHaveLength(0);
  });

  it("toasts a friend request addressed to me", () => {
    const { result } = renderHook(() => useSocialToasts());
    act(() => h.fire("friendRequestReceived", friendReq("f1", "doris", "bob")));
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0]).toMatchObject({ kind: "friend", to: "/friends" });
  });

  it("ignores a friend request addressed to someone else", () => {
    const { result } = renderHook(() => useSocialToasts());
    act(() => h.fire("friendRequestReceived", friendReq("f1", "doris", "james")));
    expect(result.current.toasts).toHaveLength(0);
  });

  it("dedupes repeated notifications for the same thread", () => {
    const { result } = renderHook(() => useSocialToasts());
    act(() => {
      h.fire("dmNotification", dm("t1", "doris"));
      h.fire("dmNotification", dm("t1", "doris"));
    });
    expect(result.current.toasts).toHaveLength(1);
  });

  it("shows separate toasts for different senders", () => {
    const { result } = renderHook(() => useSocialToasts());
    act(() => {
      h.fire("dmNotification", dm("t1", "doris"));
      h.fire("dmNotification", dm("t2", "james"));
    });
    expect(result.current.toasts).toHaveLength(2);
  });

  it("auto-dismisses a toast after its timeout", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useSocialToasts());
    act(() => h.fire("dmNotification", dm("t1", "doris")));
    expect(result.current.toasts).toHaveLength(1);
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(result.current.toasts).toHaveLength(0);
  });

  it("dismiss removes a toast on demand", () => {
    const { result } = renderHook(() => useSocialToasts());
    act(() => h.fire("dmNotification", dm("t1", "doris")));
    const id = result.current.toasts[0].id;
    act(() => result.current.dismiss(id));
    expect(result.current.toasts).toHaveLength(0);
  });

  it("pause stops the auto-dismiss; resume re-arms it", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useSocialToasts());
    act(() => h.fire("dmNotification", dm("t1", "doris")));

    // Paused (e.g. keyboard focus on the stack): the toast survives the timeout.
    act(() => result.current.pause());
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(result.current.toasts).toHaveLength(1);

    // Resumed (focus left): it dismisses again after the timeout.
    act(() => result.current.resume());
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(result.current.toasts).toHaveLength(0);
  });
});
