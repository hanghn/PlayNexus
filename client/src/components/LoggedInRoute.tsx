import { type JSX, useEffect, useMemo, useState } from "react";
import { type AuthContext, LoginContext } from "../contexts/LoginContext.ts";
import type { GameSocket } from "../util/types.ts";
import { Navigate } from "react-router-dom";

interface LoggedInRouteParams {
  auth: AuthContext | null;
  socket: GameSocket | null;
  children: JSX.Element;
}

/**
 * Ensures that, if we're not in an appropriately-initialized logged-in
 * context with auth and socket both non-null, we will navigate to `/login`.
 *
 * This setup assumes that socket will be non-null by the time auth becomes
 * non-null. This could cause unexpected behavior if the socket is unable
 * to initialize correctly. If socket is null when auth becomes non-null, we
 * will navigate back to the login page, even though the user will have just,
 * from their perspective, logged in.
 */
export default function LoggedInRoute({ auth, socket, children }: LoggedInRouteParams) {
  // Online presence state lives here — never unmounts during navigation, so
  // consumers always see the latest list regardless of which page they're on.
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!socket) return;
    const handler = (usernames: string[]) => setOnlineUsers(new Set(usernames));
    socket.on("onlineUsers", handler);
    socket.emit("getOnlineUsers");
    return () => {
      socket.off("onlineUsers", handler);
    };
  }, [socket]);

  // This use of `useMemo` is critical, because there are there are other
  // places in the app where `context` appears as part of a dependency array
  // (notably in `useAuth`). If we don't use `useMemo` here, those dependency
  // arrays will change every time the app updates.
  const context = useMemo(
    () => (auth && socket ? { ...auth, socket, onlineUsers } : null),
    [auth, socket, onlineUsers],
  );
  return context ? (
    <LoginContext.Provider value={context}>{children}</LoginContext.Provider>
  ) : (
    <Navigate to="/login" />
  );
}
