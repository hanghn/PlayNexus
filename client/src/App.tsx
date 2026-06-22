/* eslint no-console: "off" */

import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import Login from "./pages/Login.tsx";
import type { AuthContext } from "./contexts/LoginContext.ts";
import { getSession, logoutUser } from "./services/userService.ts";
import { loadAuthToken, clearAuthToken } from "./lib/authStorage.ts";
import Layout from "./components/Layout.tsx";
import Home from "./pages/Home.tsx";
import ThreadList from "./pages/ThreadList.tsx";
import Profile from "./pages/Profile.tsx";
import { io } from "socket.io-client";
import type { GameSocket } from "./util/types.ts";
import LoggedInRoute from "./components/LoggedInRoute.tsx";
import Game from "./pages/Game.tsx";
import GameList from "./pages/GameList.tsx";
import CribbageHelp from "./pages/CribbageHelp.tsx";
import ThreadPage from "./pages/ThreadPage.tsx";
import { ErrorBoundary } from "react-error-boundary";
import fallback from "./fallback.tsx";
import NewThread from "./pages/NewThread.tsx";
import Friends from "./pages/Friends.tsx";
import DMList from "./pages/DMList.tsx";
import TimeContextKeeper from "./components/UpdatingTimeContext.tsx";

/** If `true`, all incoming socket messages will be logged */
const DEBUG_SOCKETS = false;

/**
 * Websocket connection for the app. It would be natural to define this in a
 * useEffect hook, but the React docts advise against this.
 * https://react.dev/learn/you-might-not-need-an-effect#initializing-the-application
 * */
let socket: GameSocket | null = null;
if (typeof window !== "undefined") {
  socket = io();
  if (DEBUG_SOCKETS) {
    socket.onAny((tag, payload) => {
      console.log(`from socket got ${tag}(${JSON.stringify(payload)})`);
    });
  }
}

function NoSuchRoute() {
  const { pathname } = useLocation();
  return (
    <main className="content">
      <h1>Page not found</h1>
      <p>{`No page found for route '${pathname}'.`}</p>
    </main>
  );
}

export default function App() {
  const [auth, setAuth] = useState<AuthContext | null>(null);
  const [restoring, setRestoring] = useState(true);
  // On load, try to restore the logged-in user from the HttpOnly session cookie
  // so a refresh keeps the user signed in.
  useEffect(() => {
    let active = true;
    void getSession()
      .then((user) => {
        if (active && user) {
          // Re-attach the per-tab token (if it belongs to this restored user) so
          // the explicit login stays authoritative over the shared cookie.
          const stored = loadAuthToken();
          setAuth({
            user,
            pass: stored && stored.username === user.username ? stored.pass : undefined,
            reset: () => {
              void logoutUser();
              clearAuthToken();
              setAuth(null);
            },
          });
        }
      })
      .finally(() => {
        if (active) setRestoring(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // Merge fields into the current user without a full re-login (used after
  // saving a new avatar / accent so it shows immediately everywhere).
  const patchUser = useCallback((updates: Partial<AuthContext["user"]>) => {
    setAuth((prev) => (prev ? { ...prev, user: { ...prev.user, ...updates } } : prev));
  }, []);

  // Inject patchUser regardless of where `auth` was constructed (login or
  // session restore), so any consumer can update the displayed user.
  const authWithPatch = useMemo(() => (auth ? { ...auth, patchUser } : null), [auth, patchUser]);

  // While checking the session cookie, render an placeholder
  if (restoring) {
    return (
      <main className="app-loading">
        <h1>Loading…</h1>
      </main>
    );
  }

  return (
    socket && (
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login setAuth={(auth) => setAuth(auth)} />} />
          <Route
            element={
              <LoggedInRoute auth={authWithPatch} socket={socket}>
                <TimeContextKeeper updateFrequency={20 * 1000}>
                  <ErrorBoundary fallbackRender={fallback}>
                    <Layout />
                  </ErrorBoundary>
                </TimeContextKeeper>
              </LoggedInRoute>
            }
          >
            <Route path="/" element={<Home />} />
            <Route path="/forum" element={<ThreadList />} />
            <Route path="/forum/post/new" element={<NewThread />} />
            <Route path="/forum/post/:threadId" element={<ThreadPage />} />
            <Route path="/games" element={<GameList />} />
            <Route path="/game/:gameId" element={<Game />} />
            <Route path="/help/cribbage" element={<CribbageHelp />} />
            <Route path="/profile/:username" element={<Profile />} />
            <Route path="/friends" element={<Friends />} />
            <Route path="/messages" element={<DMList />} />
            {/* The conversation pane lives inside the inbox split, so both routes
                render DMList; it reads :threadId to show the open thread. */}
            <Route path="/messages/:threadId" element={<DMList />} />
            <Route path="/*" element={<NoSuchRoute />} />
          </Route>
        </Routes>
      </BrowserRouter>
    )
  );
}
