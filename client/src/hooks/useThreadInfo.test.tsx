// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import type { ThreadInfo } from "@gamenite/shared";
import useThreadInfo from "./useThreadInfo.ts";

const threadInfoMock = vi.fn();

vi.mock("../services/threadService.ts", () => ({
  threadInfo: (...args: unknown[]) => threadInfoMock(...args),
}));

const fakeThread = {
  _id: "t1",
  title: "Hello",
  text: "World",
  comments: [],
} as unknown as ThreadInfo;

describe("useThreadInfo", () => {
  beforeEach(() => {
    threadInfoMock.mockReset();
  });

  it("returns a Loading message before the request resolves", () => {
    let resolve!: (v: ThreadInfo) => void;
    threadInfoMock.mockReturnValue(new Promise<ThreadInfo>((r) => (resolve = r)));

    const { result } = renderHook(() => useThreadInfo("t1"));

    expect(result.current.threadInfo).toEqual({ message: "Loading..." });
    expect(typeof result.current.setThread).toBe("function");
    // resolve to avoid an unhandled pending promise warning
    act(() => resolve(fakeThread));
  });

  it("returns the thread once the request resolves", async () => {
    threadInfoMock.mockResolvedValue(fakeThread);

    const { result } = renderHook(() => useThreadInfo("t1"));

    await waitFor(() => {
      expect(result.current.threadInfo).toEqual(fakeThread);
    });
    expect(threadInfoMock).toHaveBeenCalledWith("t1");
  });

  it("returns an Error message when the service throws", async () => {
    threadInfoMock.mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useThreadInfo("t1"));

    await waitFor(() => {
      expect(result.current.threadInfo).toEqual({ message: "Error: Error: boom" });
    });
  });

  it("setThread updates the resolved thread to a new value", async () => {
    threadInfoMock.mockResolvedValue(fakeThread);

    const { result } = renderHook(() => useThreadInfo("t1"));

    await waitFor(() => {
      expect(result.current.threadInfo).toEqual(fakeThread);
    });

    const newThread = { ...fakeThread, title: "Updated" };
    act(() => {
      result.current.setThread(newThread);
    });

    await waitFor(() => {
      expect(result.current.threadInfo).toEqual(newThread);
    });
  });

  it("refetches when the threadId changes", async () => {
    threadInfoMock.mockResolvedValue(fakeThread);

    const { rerender } = renderHook(({ id }) => useThreadInfo(id), {
      initialProps: { id: "t1" },
    });

    await waitFor(() => {
      expect(threadInfoMock).toHaveBeenCalledWith("t1");
    });

    rerender({ id: "t2" });

    await waitFor(() => {
      expect(threadInfoMock).toHaveBeenCalledWith("t2");
    });
  });
});
