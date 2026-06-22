// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useThreadList from "./useThreadList.ts";
import { threadList } from "../services/threadService.ts";

vi.mock("../services/threadService.ts", () => ({
  threadList: vi.fn(),
}));

const mockedThreadList = vi.mocked(threadList);

const makeThread = (id: string) =>
  ({
    _id: id,
    title: `title-${id}`,
  }) as never;

describe("useThreadList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a Loading message before the request resolves", () => {
    let resolve!: (v: unknown) => void;
    mockedThreadList.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }) as never,
    );

    const { result } = renderHook(() => useThreadList());
    expect(result.current).toEqual({ message: "Loading..." });

    // resolve to avoid unhandled promise warnings
    resolve([]);
  });

  it("returns the full list of threads when resolved", async () => {
    const threads = [makeThread("a"), makeThread("b"), makeThread("c")];
    mockedThreadList.mockResolvedValue(threads);

    const { result } = renderHook(() => useThreadList());

    await waitFor(() => {
      expect(Array.isArray(result.current)).toBe(true);
    });
    expect(result.current).toEqual(threads);
    expect(mockedThreadList).toHaveBeenCalledTimes(1);
  });

  it("slices the list when maxSummaries is provided", async () => {
    const threads = [makeThread("a"), makeThread("b"), makeThread("c")];
    mockedThreadList.mockResolvedValue(threads);

    const { result } = renderHook(() => useThreadList(2));

    await waitFor(() => {
      expect(Array.isArray(result.current)).toBe(true);
    });
    expect(result.current).toHaveLength(2);
    expect(result.current).toEqual(threads.slice(0, 2));
  });

  it("returns a 'No threads found' message for an empty list", async () => {
    mockedThreadList.mockResolvedValue([]);

    const { result } = renderHook(() => useThreadList());

    await waitFor(() => {
      expect(result.current).toEqual({ message: "No threads found..." });
    });
  });

  it("returns an Error message when the request rejects", async () => {
    mockedThreadList.mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useThreadList());

    await waitFor(() => {
      expect(result.current).toEqual({ message: "Error: Error: boom" });
    });
  });
});
