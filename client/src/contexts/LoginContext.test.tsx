// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { useContext } from "react";
import { render } from "@testing-library/react";
import { LoginContext, type AuthContext } from "./LoginContext";
import type { GameSocket } from "../util/types.ts";

describe("LoginContext", () => {
  it("creates a React context defaulting to null", () => {
    let captured: unknown = "untouched";
    function Probe() {
      captured = useContext(LoginContext);
      return null;
    }
    render(<Probe />);
    expect(captured).toBeNull();
  });

  it("provides a full auth value (with socket + onlineUsers) to consumers", () => {
    const reset = vi.fn();
    const patchUser = vi.fn();

    const value: AuthContext & {
      socket: GameSocket;
      onlineUsers: Set<string>;
    } = {
      user: {
        username: "alice",
        display: "Alice",
        createdAt: new Date(),
      },
      pass: "legacy-pass",
      reset,
      patchUser,
      session: undefined,
      supabaseUserId: "supa-1",
      socket: { connected: true } as unknown as GameSocket,
      onlineUsers: new Set<string>(["user-1", "user-2"]),
    };

    let captured: typeof value | null | undefined;
    function Probe() {
      captured = useContext(LoginContext);
      return null;
    }
    render(
      <LoginContext.Provider value={value}>
        <Probe />
      </LoginContext.Provider>,
    );

    expect(captured).toBe(value);
    expect(captured?.user.username).toBe("alice");
    expect(captured?.supabaseUserId).toBe("supa-1");
    expect(captured?.onlineUsers.has("user-2")).toBe(true);

    // exercise the callbacks the interface exposes
    captured?.reset();
    captured?.patchUser?.({ pass: "new" } as Partial<AuthContext["user"]>);
    expect(reset).toHaveBeenCalledTimes(1);
    expect(patchUser).toHaveBeenCalledWith({ pass: "new" });
  });

  it("supports a minimal AuthContext shape (only required fields)", () => {
    const minimal: AuthContext = {
      user: { username: "bob" } as AuthContext["user"],
      reset: () => {},
    };
    expect(minimal.user.username).toBe("bob");
    expect(typeof minimal.reset).toBe("function");
    expect(minimal.pass).toBeUndefined();
    expect(minimal.patchUser).toBeUndefined();
  });
});
