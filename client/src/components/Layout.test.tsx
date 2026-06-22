// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { MemoryRouter } from "react-router-dom";

// --- Mocks for child components (keep Layout under test isolated) ---
vi.mock("./Header.tsx", () => ({
  default: () => <div data-testid="header" />,
}));
vi.mock("./SideBarNav.tsx", () => ({
  default: ({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) => (
    <button data-testid="sidebar" data-collapsed={String(collapsed)} onClick={onToggle}>
      sidebar
    </button>
  ),
}));
vi.mock("./GameInviteNotifications.tsx", () => ({
  default: () => <div data-testid="game-invites" />,
}));
vi.mock("./SocialToasts.tsx", () => ({
  default: () => <div data-testid="social-toasts" />,
}));
vi.mock("./LiveAnnouncer.tsx", () => ({
  default: () => <div data-testid="live-announcer" />,
}));
vi.mock("./UnreadProvider.tsx", () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="unread-provider">{children}</div>
  ),
}));

const useArrowFocusNavMock = vi.fn();
vi.mock("../hooks/useArrowFocusNav.ts", () => ({
  default: (enabled: boolean) => useArrowFocusNavMock(enabled),
}));

const useLoginContextMock = vi.fn();
vi.mock("../hooks/useLoginContext.ts", () => ({
  default: () => useLoginContextMock(),
}));

// Stub the CSS import (Vite handles this normally; vitest may too, but be safe).
vi.mock("./Layout.css", () => ({}));

import Layout from "./Layout.tsx";

// --- matchMedia stub ---
type MqEntry = { matches: boolean; listeners: Set<(e: { matches: boolean }) => void> };
let mqState: MqEntry;

function installMatchMedia(initialMatches: boolean) {
  mqState = { matches: initialMatches, listeners: new Set() };
  window.matchMedia = vi.fn().mockImplementation(() => ({
    get matches() {
      return mqState.matches;
    },
    media: "(max-width: 680px)",
    addEventListener: (_: string, cb: (e: { matches: boolean }) => void) => {
      mqState.listeners.add(cb);
    },
    removeEventListener: (_: string, cb: (e: { matches: boolean }) => void) => {
      mqState.listeners.delete(cb);
    },
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
    onchange: null,
  }));
}

function fireMediaChange(matches: boolean) {
  mqState.matches = matches;
  mqState.listeners.forEach((cb) => cb({ matches }));
}

function makeSocket() {
  const handlers: Record<string, ((...a: unknown[]) => void)[]> = {};
  return {
    emit: vi.fn(),
    on: vi.fn((event: string, cb: (...a: unknown[]) => void) => {
      (handlers[event] ??= []).push(cb);
    }),
    off: vi.fn((event: string, cb: (...a: unknown[]) => void) => {
      handlers[event] = (handlers[event] ?? []).filter((h) => h !== cb);
    }),
    _handlers: handlers,
  };
}

function renderLayout(path = "/home") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Layout />
    </MemoryRouter>,
  );
}

describe("Layout", () => {
  beforeEach(() => {
    installMatchMedia(false);
    useArrowFocusNavMock.mockReset();
    useLoginContextMock.mockReset();
    useLoginContextMock.mockReturnValue({ user: { username: "alice" }, socket: makeSocket() });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders the core layout chrome and outlet container", () => {
    renderLayout();
    expect(screen.getByTestId("unread-provider")).toBeInTheDocument();
    expect(screen.getByTestId("header")).toBeInTheDocument();
    expect(screen.getByTestId("sidebar")).toBeInTheDocument();
    expect(screen.getByTestId("game-invites")).toBeInTheDocument();
    expect(screen.getByTestId("social-toasts")).toBeInTheDocument();
    expect(screen.getByTestId("live-announcer")).toBeInTheDocument();
    expect(screen.getByText("Skip to main content")).toHaveAttribute("href", "#right_main");
    expect(screen.getByText("PlayNexus")).toBeInTheDocument();
    expect(document.getElementById("right_main")).toBeInTheDocument();
  });

  it("starts non-collapsed and toggles the sidebar collapse on desktop", () => {
    const { container } = renderLayout();
    const main = container.querySelector("#main")!;
    expect(main.className).toBe("main");
    expect(screen.getByTestId("sidebar")).toHaveAttribute("data-collapsed", "false");

    fireEvent.click(screen.getByTestId("sidebar"));
    expect(main.className).toContain("main--navCollapsed");
    expect(screen.getByTestId("sidebar")).toHaveAttribute("data-collapsed", "true");

    fireEvent.click(screen.getByTestId("sidebar"));
    expect(main.className).toBe("main");
  });

  it("ignores the collapse state when in mobile mode", () => {
    installMatchMedia(true); // mobile
    const { container } = renderLayout();
    const main = container.querySelector("#main")!;

    // Even after toggling collapse, mobile keeps the rail expanded.
    fireEvent.click(screen.getByTestId("sidebar"));
    expect(main.className).toBe("main");
    expect(screen.getByTestId("sidebar")).toHaveAttribute("data-collapsed", "false");
  });

  it("reacts to a media-query change toggling mobile on/off", () => {
    const { container } = renderLayout();
    const main = container.querySelector("#main")!;

    fireEvent.click(screen.getByTestId("sidebar")); // request collapse
    expect(main.className).toContain("main--navCollapsed");

    // Going mobile should drop the collapse visual.
    act(() => fireMediaChange(true));
    expect(main.className).toBe("main");

    // Back to desktop restores the collapse.
    act(() => fireMediaChange(false));
    expect(main.className).toContain("main--navCollapsed");
  });

  it("enables arrow-focus nav outside a game route and disables it inside one", () => {
    renderLayout("/home");
    expect(useArrowFocusNavMock).toHaveBeenLastCalledWith(true);

    cleanup();
    useArrowFocusNavMock.mockReset();
    renderLayout("/game/abc123");
    expect(useArrowFocusNavMock).toHaveBeenLastCalledWith(false);
  });

  it("announces presence on mount and on socket reconnect, cleaning up on unmount", () => {
    const socket = makeSocket();
    useLoginContextMock.mockReturnValue({ user: { username: "bob" }, socket });

    const { unmount } = renderLayout();

    // Initial announce.
    expect(socket.emit).toHaveBeenCalledWith("userOnline", { auth: { username: "bob" } });
    expect(socket.on).toHaveBeenCalledWith("connect", expect.any(Function));

    // Re-announce when the connect handler fires.
    socket.emit.mockClear();
    socket._handlers["connect"].forEach((cb) => cb());
    expect(socket.emit).toHaveBeenCalledWith("userOnline", { auth: { username: "bob" } });

    unmount();
    expect(socket.off).toHaveBeenCalledWith("connect", expect.any(Function));
  });

  it("does not announce presence when there is no socket or username", () => {
    useLoginContextMock.mockReturnValue({ user: undefined, socket: undefined });
    expect(() => renderLayout()).not.toThrow();
  });
});
