// @vitest-environment jsdom
import React from "react";
import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import useTimeSince from "./useTimeSince";
import { TimeContext } from "../contexts/TimeContext.tsx";

function wrapperWithNow(now: Date | null) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      // The context is typed as Date, but the hook explicitly handles null.
      <TimeContext.Provider value={now as unknown as Date}>{children}</TimeContext.Provider>
    );
  };
}

describe("useTimeSince", () => {
  it("formats a past date relative to the context's now (string input)", () => {
    const now = new Date("2026-01-01T12:00:00Z");
    const past = new Date("2026-01-01T11:45:00Z").toISOString(); // 15 min before now
    const { result } = renderHook(() => useTimeSince(), {
      wrapper: wrapperWithNow(now),
    });

    expect(result.current(past)).toBe("15 minutes ago");
  });

  it("formats a past date relative to the context's now (Date input)", () => {
    const now = new Date("2026-01-01T12:00:00Z");
    const past = new Date("2026-01-01T11:00:00Z"); // an hour before now
    const { result } = renderHook(() => useTimeSince(), {
      wrapper: wrapperWithNow(now),
    });

    expect(result.current(past)).toBe("an hour ago");
  });

  it("returns 'just now' for dates in the future relative to now", () => {
    const now = new Date("2026-01-01T12:00:00Z");
    const future = new Date("2026-01-01T13:00:00Z");
    const { result } = renderHook(() => useTimeSince(), {
      wrapper: wrapperWithNow(now),
    });

    expect(result.current(future)).toBe("just now");
  });

  it("uses the custom 'seconds' locale string for sub-minute differences", () => {
    const now = new Date("2026-01-01T12:00:00Z");
    const past = new Date("2026-01-01T11:59:50Z"); // 10 seconds before now
    const { result } = renderHook(() => useTimeSince(), {
      wrapper: wrapperWithNow(now),
    });

    expect(result.current(past)).toBe("seconds ago");
  });

  it("falls back to fromNow() when now is null", () => {
    const past = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { result } = renderHook(() => useTimeSince(), {
      wrapper: wrapperWithNow(null),
    });

    expect(result.current(past)).toBe("15 minutes ago");
  });

  it("returns a stable callback for the same now value", () => {
    const now = new Date("2026-01-01T12:00:00Z");
    const { result, rerender } = renderHook(() => useTimeSince(), {
      wrapper: wrapperWithNow(now),
    });
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
