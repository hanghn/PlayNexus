// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

const useLoginContextMock = vi.fn();

vi.mock("./useLoginContext.ts", () => ({
  __esModule: true,
  default: () => useLoginContextMock(),
}));

import useOnlineStatus from "./useOnlinestatus.ts";

describe("useOnlineStatus", () => {
  beforeEach(() => {
    useLoginContextMock.mockReset();
  });

  it("returns the onlineUsers set from the login context", () => {
    const onlineUsers = new Set<string>(["alice", "bob"]);
    useLoginContextMock.mockReturnValue({ onlineUsers });

    const { result } = renderHook(() => useOnlineStatus());

    expect(result.current.onlineUsers).toBe(onlineUsers);
    expect(Array.from(result.current.onlineUsers)).toEqual(["alice", "bob"]);
  });

  it("only exposes onlineUsers, ignoring other context fields", () => {
    const onlineUsers = new Set<string>();
    useLoginContextMock.mockReturnValue({
      onlineUsers,
      socket: {},
      user: { username: "carol" },
      reset: () => {},
    });

    const { result } = renderHook(() => useOnlineStatus());

    expect(Object.keys(result.current)).toEqual(["onlineUsers"]);
    expect(result.current.onlineUsers.size).toBe(0);
  });

  it("reflects updated onlineUsers on re-render", () => {
    useLoginContextMock.mockReturnValue({ onlineUsers: new Set(["a"]) });
    const { result, rerender } = renderHook(() => useOnlineStatus());
    expect(result.current.onlineUsers.has("a")).toBe(true);

    useLoginContextMock.mockReturnValue({ onlineUsers: new Set(["a", "b"]) });
    rerender();
    expect(result.current.onlineUsers.has("b")).toBe(true);
  });
});
