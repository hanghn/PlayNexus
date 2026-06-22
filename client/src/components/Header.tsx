import useLoginContext from "../hooks/useLoginContext.ts";
import "./Header.css";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import badgeLogo from "../assets/playnexus-pn-badge.png";
import wordmark from "../assets/playnexus-name.png";
import FriendRequestBell from "./FriendRequestBell.tsx";

/**
 * Header banner: the PlayNexus badge logo + wordmark (top-left, links home) and
 * an account chip (top-right) that opens a dropdown with account actions.
 */
export default function Header() {
  const { user, reset } = useLoginContext();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const goProfile = () => {
    setMenuOpen(false);
    void navigate(`/profile/${user.username}`);
  };

  const logOut = async () => {
    setMenuOpen(false);
    reset();
    await navigate("/login");
  };

  return (
    <header id="header" className="header">
      <button className="brand" onClick={() => navigate("/")} aria-label="PlayNexus home">
        <img src={badgeLogo} alt="" className="brand-logo" />
        <img src={wordmark} alt="PlayNexus" className="brand-name" />
      </button>
      <div className="header-account">
        <FriendRequestBell />
        <button
          type="button"
          className="header-id"
          onClick={() => setMenuOpen((o) => !o)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setMenuOpen(false);
          }}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label={`Account menu for ${user.display}`}
          title="Account menu"
        >
          {user.avatarUrl ? (
            <img
              className="header-avatar header-avatar--img"
              src={user.avatarUrl}
              alt=""
              style={user.accentColor ? { boxShadow: `0 0 0 2px ${user.accentColor}` } : undefined}
            />
          ) : (
            <span
              className="header-avatar"
              aria-hidden="true"
              style={user.accentColor ? { boxShadow: `0 0 0 2px ${user.accentColor}` } : undefined}
            >
              {(user.display || user.username || "?").charAt(0).toUpperCase()}
            </span>
          )}
          <span className="header-id-text">
            <span className="header-id-label">signed in as</span>
            <span className="header-id-name">{user.display}</span>
          </span>
          <span className="header-id-caret" aria-hidden="true">
            ▾
          </span>
        </button>

        {menuOpen && (
          <>
            <div className="header-menu-backdrop" onClick={() => setMenuOpen(false)} />
            <div className="header-menu" role="menu">
              <button
                type="button"
                role="menuitem"
                className="header-menu-item"
                onClick={goProfile}
              >
                View Profile
              </button>
              <button
                type="button"
                role="menuitem"
                className="header-menu-item header-menu-item--danger"
                onClick={logOut}
              >
                Log Out
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
