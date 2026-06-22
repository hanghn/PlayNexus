// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import React from "react";
import useLoginContext from "./useLoginContext.ts";
import { LoginContext } from "../contexts/LoginContext.ts";
import type { GameSocket } from "../util/types.ts";
import type { SafeUserInfo } from "@gamenite/shared";

describe("useLoginContext", () => {
  it("throws when used outside of a LoginContext provider (null context)", () => {
    expect(() => renderHook(() => useLoginContext())).toThrowError("Login context is null.");
  });

  it("returns the context value when wrapped in a LoginContext provider", () => {
    const reset = vi.fn();
    const patchUser = vi.fn();
    const socket = { id: "socket-1" } as unknown as GameSocket;
    const user = { id: "u1", username: "alice" } as unknown as SafeUserInfo;
    const onlineUsers = new Set<string>(["u1", "u2"]);

    const contextValue = {
      socket,
      user,
      pass: "legacy-pass",
      reset,
      patchUser,
      onlineUsers,
    };

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(LoginContext.Provider, { value: contextValue }, children);

    const { result } = renderHook(() => useLoginContext(), { wrapper });

    expect(result.current.socket).toBe(socket);
    expect(result.current.user).toBe(user);
    expect(result.current.pass).toBe("legacy-pass");
    expect(result.current.onlineUsers).toBe(onlineUsers);

    result.current.reset();
    expect(reset).toHaveBeenCalledTimes(1);

    result.current.patchUser?.({ username: "bob" });
    expect(patchUser).toHaveBeenCalledWith({ username: "bob" });
  });
});
