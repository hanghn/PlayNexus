// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useContext } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Layout from "../../src/components/Layout.tsx";
import LoggedInRoute from "../../src/components/LoggedInRoute.tsx";
import { LoginContext } from "../../src/contexts/LoginContext.ts";

const appState = vi.hoisted(() => {
  const handlers: Record<string, Set<(...args: unknown[]) => void>> = {};
  const socket = {
    emit: vi.fn(),
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      (handlers[event] ??= new Set()).add(handler);
    }),
    off: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      handlers[event]?.delete(handler);
    }),
  };
  return {
    socket,
    user: { username: "bob", display: "Bob", createdAt: new Date("2026-01-01T00:00:00.000Z") },
    fire(event: string, ...args: unknown[]) {
      for (const handler of handlers[event] ?? []) handler(...args);
    },
    reset() {
      for (const key of Object.keys(handlers)) delete handlers[key];
      socket.emit.mockReset();
      socket.on.mockClear();
      socket.off.mockClear();
    },
  };
});

vi.mock("../../src/hooks/useLoginContext.ts", () => ({
  default: () => ({ user: appState.user, socket: appState.socket, reset: vi.fn() }),
}));

const useArrowFocusNav = vi.fn();
vi.mock("../../src/hooks/useArrowFocusNav.ts", () => ({
  default: (enabled: boolean) => useArrowFocusNav(enabled),
}));

vi.mock("../../src/components/Header.tsx", () => ({
  default: () => <header data-testid="header" />,
}));
vi.mock("../../src/components/SideBarNav.tsx", () => ({
  default: ({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) => (
    <button
      type="button"
      aria-label="toggle sidebar"
      data-collapsed={String(collapsed)}
      onClick={onToggle}
    >
      nav
    </button>
  ),
}));
vi.mock("../../src/components/GameInviteNotifications.tsx", () => ({
  default: () => <div data-testid="game-invites" />,
}));
vi.mock("../../src/components/SocialToasts.tsx", () => ({
  default: () => <div data-testid="social-toasts" />,
}));
vi.mock("../../src/components/LiveAnnouncer.tsx", () => ({
  default: () => <div data-testid="live-announcer" />,
}));
vi.mock("../../src/components/UnreadProvider.tsx", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,

    Navigate: ({ to }: { to: string }) => <div data-testid="navigate" data-to={to} />,
  };
});

beforeEach(() => {
  appState.reset();
  useArrowFocusNav.mockReset();
  window.matchMedia = vi.fn(() => ({
    matches: false,
    media: "(max-width: 680px)",
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as never;
});

afterEach(() => {
  cleanup();
});

describe("Layout", () => {
  it("announces the online user, exposes the shell, and toggles the nav collapse state", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="*" element={<Layout />}>
            <Route index element={<div data-testid="home">home</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(useArrowFocusNav).toHaveBeenCalledWith(true);
    expect(appState.socket.emit).toHaveBeenCalledWith("userOnline", { auth: { username: "bob" } });
    expect(screen.getByTestId("header")).toBeTruthy();
    expect(screen.getByTestId("home")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "toggle sidebar" }));
    expect(screen.getByRole("main").parentElement?.className).toContain("main--navCollapsed");

    act(() => {
      appState.fire("connect");
    });
    expect(appState.socket.emit).toHaveBeenCalledTimes(2);
  });

  it("disables arrow-focus nav while inside a live game route", () => {
    render(
      <MemoryRouter initialEntries={["/game/123"]}>
        <Routes>
          <Route path="*" element={<Layout />}>
            <Route path="game/:id" element={<div data-testid="game">game</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(useArrowFocusNav).toHaveBeenCalledWith(false);
    expect(screen.getByTestId("game")).toBeTruthy();
  });
});

describe("LoggedInRoute", () => {
  function ContextReader() {
    const ctx = useContext(LoginContext);
    return (
      <div data-testid="ctx">{ctx ? `${ctx.user.username}:${ctx.onlineUsers.size}` : "none"}</div>
    );
  }

  it("redirects to /login when the session is missing", () => {
    render(
      <MemoryRouter>
        <LoggedInRoute auth={null} socket={null}>
          <div>child</div>
        </LoggedInRoute>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("navigate").getAttribute("data-to")).toBe("/login");
  });

  it("provides auth, socket, and online users to children when logged in", () => {
    render(
      <MemoryRouter>
        <LoggedInRoute
          auth={{ user: appState.user, reset: vi.fn() }}
          socket={appState.socket as never}
        >
          <ContextReader />
        </LoggedInRoute>
      </MemoryRouter>,
    );

    expect(appState.socket.emit).toHaveBeenCalledWith("getOnlineUsers");
    act(() => {
      appState.fire("onlineUsers", ["bob", "doris"]);
    });
    expect(screen.getByTestId("ctx").textContent).toBe("bob:2");
  });
});
