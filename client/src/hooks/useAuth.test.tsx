// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

// Mock the consuming context hook so useAuth can be exercised in isolation.
const useLoginContextMock = vi.fn();
vi.mock("./useLoginContext.ts", () => ({
  default: () => useLoginContextMock(),
}));

import useAuth from "./useAuth.ts";

describe("useAuth", () => {
  beforeEach(() => {
    useLoginContextMock.mockReset();
  });

  it("returns username and password from the login context", () => {
    useLoginContextMock.mockReturnValue({
      user: { username: "alice" },
      pass: "secret",
    });

    const { result } = renderHook(() => useAuth());

    expect(result.current).toEqual({ username: "alice", password: "secret" });
  });

  it("defaults password to an empty string when pass is undefined", () => {
    useLoginContextMock.mockReturnValue({
      user: { username: "bob" },
      pass: undefined,
    });

    const { result } = renderHook(() => useAuth());

    expect(result.current).toEqual({ username: "bob", password: "" });
  });

  it("returns a stable (memoized) reference across re-renders when inputs are unchanged", () => {
    useLoginContextMock.mockReturnValue({
      user: { username: "carol" },
      pass: "pw",
    });

    const { result, rerender } = renderHook(() => useAuth());
    const first = result.current;

    rerender();

    expect(result.current).toBe(first);
  });

  it("produces a new reference when the username changes", () => {
    useLoginContextMock.mockReturnValue({
      user: { username: "dave" },
      pass: "pw",
    });

    const { result, rerender } = renderHook(() => useAuth());
    const first = result.current;

    useLoginContextMock.mockReturnValue({
      user: { username: "dave2" },
      pass: "pw",
    });
    rerender();

    expect(result.current).not.toBe(first);
    expect(result.current.username).toBe("dave2");
  });

  it("produces a new reference when the password changes", () => {
    useLoginContextMock.mockReturnValue({
      user: { username: "erin" },
      pass: "pw1",
    });

    const { result, rerender } = renderHook(() => useAuth());
    const first = result.current;

    useLoginContextMock.mockReturnValue({
      user: { username: "erin" },
      pass: "pw2",
    });
    rerender();

    expect(result.current).not.toBe(first);
    expect(result.current.password).toBe("pw2");
  });
});
