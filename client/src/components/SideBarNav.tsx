import "./SideBarNav.css";
import useAuth from "../hooks/useAuth.ts";
import { NavLink, type NavLinkRenderProps } from "react-router-dom";
import useUnread from "../hooks/useUnread.ts";
/**
 * The SideBarNav component contains the primary navigation menu. It highlights
 * the currently selected page and triggers navigation when the menu items are
 * clicked. It can be collapsed to a thin strip via the toggle at the top.
 */
export default function SideBarNav({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const { username } = useAuth();

  const navClass = ({ isActive }: NavLinkRenderProps) =>
    `menu_button ${isActive ? "menu_selected" : ""}`;

  // Total unread DMs across all threads (cleared per-thread as you read them).
  const { total: unread } = useUnread();

  return (
    <nav className={`sideBarNav${collapsed ? " sideBarNav--collapsed" : ""}`} aria-label="Primary">
      <button
        type="button"
        className="sideBarToggle"
        onClick={onToggle}
        aria-label={collapsed ? "Expand menu" : "Collapse menu"}
        title={collapsed ? "Expand menu" : "Collapse menu"}
      >
        {collapsed ? "»" : "«"}
      </button>
      {!collapsed && (
        <>
          <NavLink to="/" className={navClass}>
            Home
          </NavLink>
          <NavLink to="/games" className={navClass}>
            Games
          </NavLink>
          <NavLink to="/forum" className={navClass}>
            Forum
          </NavLink>
          <NavLink to="/friends" className={navClass}>
            Friends
          </NavLink>
          <NavLink to="/messages" className={navClass}>
            Messages
            {unread > 0 && (
              <span className="nav-badge" aria-label={`${unread} unread messages`}>
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </NavLink>
          <NavLink to={`/profile/${username}`} id="menu_user" className={navClass}>
            Profile
          </NavLink>
        </>
      )}
    </nav>
  );
}
