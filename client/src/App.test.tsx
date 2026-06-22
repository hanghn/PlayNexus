// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup, fireEvent } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";

expect.extend(matchers);

// --- Socket.io: return a stub socket so App's module-level `io()` is harmless.
vi.mock("socket.io-client", () => ({
  io: vi.fn(() => ({
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    onAny: vi.fn(),
  })),
}));

// --- userService: control the session-restore flow.
const getSession = vi.fn();
const logoutUser = vi.fn();
vi.mock("./services/userService.ts", () => ({
  getSession: () => getSession(),
  logoutUser: () => logoutUser(),
}));

// --- authStorage: per-tab token helpers.
const loadAuthToken = vi.fn();
const clearAuthToken = vi.fn();
vi.mock("./lib/authStorage.ts", () => ({
  loadAuthToken: () => loadAuthToken(),
  clearAuthToken: () => clearAuthToken(),
}));

// --- Page / component stubs. Each renders an identifiable marker so we can
// assert which route matched without pulling in heavy real components.
vi.mock("./pages/Login.tsx", () => ({
  default: ({ setAuth }: { setAuth: (a: unknown) => void }) => (
    <div data-testid="login" onClick={() => setAuth({ user: { username: "x" } })}>
      login-page
    </div>
  ),
}));
vi.mock("./pages/Home.tsx", () => ({ default: () => <div data-testid="home">home</div> }));
vi.mock("./pages/ThreadList.tsx", () => ({ default: () => <div>threads</div> }));
vi.mock("./pages/Profile.tsx", () => ({ default: () => <div>profile</div> }));
vi.mock("./pages/Game.tsx", () => ({ default: () => <div>game</div> }));
vi.mock("./pages/GameList.tsx", () => ({ default: () => <div>gamelist</div> }));
vi.mock("./pages/CribbageHelp.tsx", () => ({ default: () => <div>help</div> }));
vi.mock("./pages/ThreadPage.tsx", () => ({ default: () => <div>thread</div> }));
vi.mock("./pages/NewThread.tsx", () => ({ default: () => <div>newthread</div> }));
vi.mock("./pages/Friends.tsx", () => ({ default: () => <div>friends</div> }));
vi.mock("./pages/DMList.tsx", () => ({ default: () => <div>dmlist</div> }));

// Layout sits at the parent route; the matched child route renders into its
// <Outlet>, so the stub must render one for nested routes (Home, NoSuchRoute) to
// appear.
vi.mock("./components/Layout.tsx", async () => {
  const { Outlet } = await import("react-router-dom");
  return {
    default: () => (
      <div data-testid="layout">
        <Outlet />
      </div>
    ),
  };
});
vi.mock("./components/UpdatingTimeContext.tsx", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("./fallback.tsx", () => ({ default: () => <div>fallback</div> }));

// LoggedInRoute decides logged-in vs redirect. Stub it: render children when
// auth is present, otherwise render a marker standing in for the /login redirect.
type AuthLike = {
  reset?: () => void;
  patchUser?: (u: Record<string, unknown>) => void;
} | null;
vi.mock("./components/LoggedInRoute.tsx", () => ({
  default: ({ auth, children }: { auth: AuthLike; children: React.ReactNode }) =>
    auth ? (
      <div data-testid="protected">
        <button data-testid="reset" onClick={() => auth.reset?.()}>
          reset
        </button>
        <button data-testid="patch" onClick={() => auth.patchUser?.({ accent: "blue" })}>
          patch
        </button>
        {children}
      </div>
    ) : (
      <div data-testid="redirect">redirect</div>
    ),
}));

import App from "./App.tsx";

const user = { username: "alice" };

describe("App", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/");
    loadAuthToken.mockReturnValue(null);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows a loading placeholder while the session is being restored", () => {
    // Never-resolving promise keeps `restoring` true.
    getSession.mockReturnValue(new Promise(() => {}));
    render(<App />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("renders the protected layout for the index route once a session is restored", async () => {
    loadAuthToken.mockReturnValue({ username: "alice", pass: "secret" });
    getSession.mockResolvedValue(user);

    render(<App />);

    await waitFor(() => expect(screen.getByTestId("protected")).toBeInTheDocument());
    expect(screen.getByTestId("layout")).toBeInTheDocument();
    expect(screen.getByTestId("home")).toBeInTheDocument();
  });

  it("redirects (no auth) when there is no restored session", async () => {
    getSession.mockResolvedValue(null);

    render(<App />);

    await waitFor(() => expect(screen.getByTestId("redirect")).toBeInTheDocument());
    expect(screen.queryByTestId("protected")).not.toBeInTheDocument();
  });

  it("renders the Login page on the /login route", async () => {
    window.history.pushState({}, "", "/login");
    getSession.mockResolvedValue(null);

    render(<App />);

    await waitFor(() => expect(screen.getByTestId("login")).toBeInTheDocument());
  });

  it("renders NoSuchRoute for an unknown path while logged in", async () => {
    window.history.pushState({}, "", "/totally/unknown");
    getSession.mockResolvedValue(user);

    render(<App />);

    await waitFor(() => expect(screen.getByText("Page not found")).toBeInTheDocument());
    expect(screen.getByText(/No page found for route '\/totally\/unknown'/)).toBeInTheDocument();
  });

  it("logs out via the auth reset callback and drops to the redirect state", async () => {
    loadAuthToken.mockReturnValue({ username: "alice", pass: "secret" });
    getSession.mockResolvedValue(user);

    render(<App />);
    await waitFor(() => expect(screen.getByTestId("protected")).toBeInTheDocument());

    fireEvent.click(screen.getByTestId("reset"));

    await waitFor(() => expect(screen.getByTestId("redirect")).toBeInTheDocument());
    expect(logoutUser).toHaveBeenCalledTimes(1);
    expect(clearAuthToken).toHaveBeenCalledTimes(1);
  });

  it("patches the current user without dropping the session", async () => {
    loadAuthToken.mockReturnValue({ username: "alice", pass: "secret" });
    getSession.mockResolvedValue(user);

    render(<App />);
    await waitFor(() => expect(screen.getByTestId("protected")).toBeInTheDocument());

    fireEvent.click(screen.getByTestId("patch"));

    // Still logged in (auth merge keeps the session intact).
    expect(screen.getByTestId("protected")).toBeInTheDocument();
  });

  it("ignores the stored token when it belongs to a different user", async () => {
    loadAuthToken.mockReturnValue({ username: "someone-else", pass: "p" });
    getSession.mockResolvedValue(user);

    render(<App />);

    await waitFor(() => expect(screen.getByTestId("protected")).toBeInTheDocument());
    // Reaching the protected layout means auth was constructed (pass branch covered).
    expect(screen.getByTestId("home")).toBeInTheDocument();
  });
});
