// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const getDMThreadList = vi.fn();
const useLoginContext = vi.fn();

vi.mock("../services/dmService.ts", () => ({
  getDMThreadList: (...args: unknown[]) => getDMThreadList(...args),
}));

vi.mock("./useLoginContext.ts", () => ({
  default: () => useLoginContext(),
}));

import useDMList from "./useDMList.ts";

type SocketHandlers = Record<string, (...args: unknown[]) => void>;

function makeSocket() {
  const handlers: SocketHandlers = {};
  return {
    on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
      handlers[event] = cb;
    }),
    off: vi.fn((event: string) => {
      delete handlers[event];
    }),
    emit: (event: string, ...args: unknown[]) => handlers[event]?.(...args),
    handlers,
  };
}

const sampleThreads = [
  { _id: "t1", participants: ["me", "alice"] },
  { _id: "t2", participants: ["me", "bob"] },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useDMList", () => {
  it("loads the DM thread list on mount", async () => {
    const socket = makeSocket();
    useLoginContext.mockReturnValue({ user: { username: "me" }, socket });
    getDMThreadList.mockResolvedValue(sampleThreads);

    const { result } = renderHook(() => useDMList());

    expect(result.current.threads).toBeNull();
    expect(result.current.error).toBeNull();

    await waitFor(() => expect(result.current.threads).toEqual(sampleThreads));
    expect(result.current.error).toBeNull();
    expect(getDMThreadList).toHaveBeenCalledWith("me");
    expect(socket.on).toHaveBeenCalledWith("dmNotification", expect.any(Function));
  });

  it("sets an error message when the fetch rejects", async () => {
    const socket = makeSocket();
    useLoginContext.mockReturnValue({ user: { username: "me" }, socket });
    getDMThreadList.mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useDMList());

    await waitFor(() => expect(result.current.error).toBe("Error: boom"));
    expect(result.current.threads).toBeNull();
  });

  it("refreshes the list when a dmNotification arrives", async () => {
    const socket = makeSocket();
    useLoginContext.mockReturnValue({ user: { username: "me" }, socket });
    getDMThreadList.mockResolvedValueOnce(sampleThreads);

    const { result } = renderHook(() => useDMList());
    await waitFor(() => expect(result.current.threads).toEqual(sampleThreads));

    const refreshed = [...sampleThreads, { _id: "t3", participants: ["me", "carol"] }];
    getDMThreadList.mockResolvedValueOnce(refreshed);

    socket.emit("dmNotification");

    await waitFor(() => expect(result.current.threads).toEqual(refreshed));
    expect(getDMThreadList).toHaveBeenCalledTimes(2);
  });

  it("unsubscribes from the socket on unmount", async () => {
    const socket = makeSocket();
    useLoginContext.mockReturnValue({ user: { username: "me" }, socket });
    getDMThreadList.mockResolvedValue(sampleThreads);

    const { unmount } = renderHook(() => useDMList());
    await waitFor(() => expect(socket.on).toHaveBeenCalled());

    unmount();
    expect(socket.off).toHaveBeenCalledWith("dmNotification", expect.any(Function));
  });

  it("still loads when there is no socket", async () => {
    useLoginContext.mockReturnValue({ user: { username: "solo" }, socket: undefined });
    getDMThreadList.mockResolvedValue(sampleThreads);

    const { result, unmount } = renderHook(() => useDMList());

    await waitFor(() => expect(result.current.threads).toEqual(sampleThreads));
    expect(getDMThreadList).toHaveBeenCalledWith("solo");
    // cleanup path for the no-socket branch returns a noop
    expect(() => unmount()).not.toThrow();
  });
});
