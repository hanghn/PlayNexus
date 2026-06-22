// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { useContext } from "react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import LoggedInRoute from "./LoggedInRoute.tsx";
import { LoginContext, type AuthContext } from "../contexts/LoginContext.ts";
import type { GameSocket } from "../util/types.ts";

// A minimal fake socket capturing the registered handlers.
function makeFakeSocket() {
  const handlers: Record<string, ((...args: unknown[]) => void)[]> = {};
  const socket = {
    on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
      (handlers[event] ??= []).push(cb);
      return socket;
    }),
    off: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
      handlers[event] = (handlers[event] ?? []).filter((h) => h !== cb);
      return socket;
    }),
    emit: vi.fn(() => socket),
    __emitToHandlers(event: string, ...args: unknown[]) {
      (handlers[event] ?? []).forEach((h) => h(...args));
    },
    __handlers: handlers,
  };
  return socket;
}

const fakeAuth: AuthContext = {
  user: { username: "alice" } as AuthContext["user"],
  reset: vi.fn(),
};

// Consumer that reads the LoginContext so we can assert on its value.
function Consumer() {
  const ctx = useContext(LoginContext);
  return (
    <div>
      <span data-testid="username">{ctx?.user.username ?? "none"}</span>
      <span data-testid="online">{[...(ctx?.onlineUsers ?? [])].join(",")}</span>
      <span data-testid="has-socket">{ctx?.socket ? "yes" : "no"}</span>
    </div>
  );
}

function renderRoute(auth: AuthContext | null, socket: GameSocket | null) {
  return render(
    <MemoryRouter initialEntries={["/protected"]}>
      <Routes>
        <Route
          path="/protected"
          element={
            <LoggedInRoute auth={auth} socket={socket}>
              <Consumer />
            </LoggedInRoute>
          }
        />
        <Route path="/login" element={<div>LOGIN PAGE</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("LoggedInRoute", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders children inside LoginContext when auth and socket are both present", () => {
    const socket = makeFakeSocket();
    renderRoute(fakeAuth, socket as unknown as GameSocket);

    expect(screen.getByTestId("username").textContent).toBe("alice");
    expect(screen.getByTestId("has-socket").textContent).toBe("yes");
  });

  it("subscribes to onlineUsers and requests the current list on mount", () => {
    const socket = makeFakeSocket();
    renderRoute(fakeAuth, socket as unknown as GameSocket);

    expect(socket.on).toHaveBeenCalledWith("onlineUsers", expect.any(Function));
    expect(socket.emit).toHaveBeenCalledWith("getOnlineUsers");
  });

  it("updates onlineUsers in context when the socket emits onlineUsers", async () => {
    const socket = makeFakeSocket();
    renderRoute(fakeAuth, socket as unknown as GameSocket);

    expect(screen.getByTestId("online").textContent).toBe("");

    socket.__emitToHandlers("onlineUsers", ["bob", "carol"]);

    await waitFor(() => expect(screen.getByTestId("online").textContent).toBe("bob,carol"));
  });

  it("cleans up the onlineUsers handler on unmount", () => {
    const socket = makeFakeSocket();
    const { unmount } = renderRoute(fakeAuth, socket as unknown as GameSocket);

    expect(socket.__handlers["onlineUsers"]?.length).toBe(1);
    unmount();
    expect(socket.off).toHaveBeenCalledWith("onlineUsers", expect.any(Function));
    expect(socket.__handlers["onlineUsers"]?.length).toBe(0);
  });

  it("navigates to /login when auth is null", () => {
    const socket = makeFakeSocket();
    renderRoute(null, socket as unknown as GameSocket);

    expect(screen.getByText("LOGIN PAGE")).toBeTruthy();
    expect(screen.queryByTestId("username")).toBeNull();
  });

  it("navigates to /login when socket is null and never subscribes", () => {
    renderRoute(fakeAuth, null);

    expect(screen.getByText("LOGIN PAGE")).toBeTruthy();
  });
});
