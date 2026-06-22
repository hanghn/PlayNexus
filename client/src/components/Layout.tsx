import "./Layout.css";
import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Header from "./Header.tsx";
import SideBarNav from "./SideBarNav.tsx";
import GameInviteNotifications from "./GameInviteNotifications.tsx";
import SocialToasts from "./SocialToasts.tsx";
import LiveAnnouncer from "./LiveAnnouncer.tsx";
import UnreadProvider from "./UnreadProvider.tsx";
import useLoginContext from "../hooks/useLoginContext.ts";
import useArrowFocusNav from "../hooks/useArrowFocusNav.ts";

/**
 * Main component represents the layout of the main page, including a sidebar
 * and the main content area.
 */
export default function Layout() {
  // The sidebar can collapse to a thin strip; the state lives here because the
  // grid column width (in .main) has to react to it.
  const [navCollapsed, setNavCollapsed] = useState(false);
  // On mobile the rail becomes a horizontal nav, so the desktop collapse is
  // ignored and the links always render.
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 680px)").matches,
  );
  const { user, socket } = useLoginContext();

  // Arrow keys move focus across the whole site, except inside a live game
  // (/game/:id) where the arrows drive the game itself.
  const location = useLocation();
  useArrowFocusNav(!location.pathname.startsWith("/game/"));

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 680px)");
    const update = () => setIsMobile(mq.matches);
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const collapsed = navCollapsed && !isMobile;

  // Announce presence for the WHOLE session (re-announcing on every reconnect),
  // so friends see us online anywhere — not only while the Profile page is open.
  useEffect(() => {
    if (!socket || !user?.username) return;
    const announce = () => socket.emit("userOnline", { auth: { username: user.username } });
    announce();
    socket.on("connect", announce);
    return () => {
      socket.off("connect", announce);
    };
  }, [socket, user?.username]);

  return (
    <UnreadProvider>
      <div id="main" className={`main${collapsed ? " main--navCollapsed" : ""}`}>
        {/* First focusable element: lets keyboard users jump past the nav. */}
        <a className="skip-link" href="#right_main">
          Skip to main content
        </a>
        <Header />
        <SideBarNav collapsed={collapsed} onToggle={() => setNavCollapsed((c) => !c)} />
        <main id="right_main" className="right_main" tabIndex={-1}>
          <h1 className="sr-only">PlayNexus</h1>
          <Outlet />
        </main>
      </div>
      {/* Global game-invitation toasts; appear on any page */}
      <GameInviteNotifications />
      {/* Toasts for new DMs and friend requests */}
      <SocialToasts />
      {/* Screen-reader announcements for in-app events */}
      <LiveAnnouncer />
    </UnreadProvider>
  );
}
