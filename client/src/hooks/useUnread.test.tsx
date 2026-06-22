// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import useUnread from "./useUnread.ts";
import { UnreadContext, type UnreadContextValue } from "../contexts/UnreadContext.ts";

describe("useUnread", () => {
  it("throws when used outside an UnreadProvider", () => {
    expect(() => renderHook(() => useUnread())).toThrow(
      "useUnread must be used within an UnreadProvider",
    );
  });

  it("returns the context value when wrapped in a provider", () => {
    const markThreadRead = vi.fn();
    const value: UnreadContextValue = {
      counts: { t1: 2, t2: 3 },
      total: 5,
      markThreadRead,
    };

    const wrapper = ({ children }: { children: ReactNode }) => (
      <UnreadContext.Provider value={value}>{children}</UnreadContext.Provider>
    );

    const { result } = renderHook(() => useUnread(), { wrapper });

    expect(result.current).toBe(value);
    expect(result.current.counts).toEqual({ t1: 2, t2: 3 });
    expect(result.current.total).toBe(5);

    result.current.markThreadRead("t1");
    expect(markThreadRead).toHaveBeenCalledWith("t1");
  });
});
