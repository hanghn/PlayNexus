import { useState, useEffect, useRef, type ChangeEvent } from "react";
import useLoginContext from "../hooks/useLoginContext.ts";
import useAuth from "../hooks/useAuth.ts";
import useEditProfileForm from "../hooks/useEditProfileForm.ts";
import useTimeSince from "../hooks/useTimeSince.ts";
import { NavLink, useNavigate, useParams } from "react-router-dom";
import type { GameInfo, SafeUserInfo } from "@gamenite/shared";
import useFriends from "../hooks/useFriends.ts";
import useOnlineStatus from "../hooks/useOnlinestatus.ts";
import SecuritySettings from "../components/SecuritySettings.tsx";
import AccessibilitySettings from "../components/AccessibilitySettings.tsx";
import { getUserById } from "../services/userService.ts";
import { gameList } from "../services/gameService.ts";
import { gameNames } from "../util/consts.ts";
import { openDMThread } from "../services/dmService.ts";
import { apiErrorMessage } from "../services/api.ts";
import "./Profile.css";

/** Initial letter used for the avatar placeholder. */
function initialFor(u: { display?: string; username: string }): string {
  return (u.display || u.username || "?").charAt(0).toUpperCase();
}

/**
 * Profile dispatcher. Your own profile (no `:username`, or it matches you) is
 * fully editable; any other user's profile is shown read-only.
 */
export default function Profile() {
  const { user } = useLoginContext();
  const { username } = useParams<{ username: string }>();
  if (!username || username === user.username) return <OwnProfile />;
  // key by username so switching between users remounts (resets) cleanly.
  return <PublicProfile key={username} username={username} />;
}

/** Read-only view of another user's profile. */
function PublicProfile({ username }: { username: string }) {
  const timeSince = useTimeSince();
  const auth = useAuth();
  const navigate = useNavigate();
  const { onlineUsers } = useOnlineStatus();
  const [profile, setProfile] = useState<SafeUserInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getUserById(username)
      .then((u) => active && setProfile(u))
      .catch((e) => active && setError(apiErrorMessage(e, "User not found")));
    return () => {
      active = false;
    };
  }, [username]);

  const handleMessage = async () => {
    try {
      const thread = await openDMThread(auth, username);
      await navigate(`/messages/${thread.threadId}`);
    } catch {
      /* ignore — the Message button is best-effort */
    }
  };

  if (error) return <div className="pf-page pf-state">{error}</div>;
  if (!profile) return <div className="pf-page pf-state">Loading…</div>;

  const accent = profile.accentColor || "";
  const online = onlineUsers.has(profile.username);

  return (
    <div className="pf-page">
      <header className="pf-hero">
        <div className="pf-banner" style={{ background: accent || "var(--teal-dark)" }} />
        <div className="pf-hero-body">
          <div className="pf-avatar-block">
            <span
              className="pf-hero-avatar"
              style={profile.avatarUrl ? undefined : { background: accent || "var(--teal)" }}
            >
              {profile.avatarUrl ? (
                <img className="pf-hero-img" src={profile.avatarUrl} alt="" />
              ) : (
                <span aria-hidden="true">{initialFor(profile)}</span>
              )}
            </span>
          </div>
          <div className="pf-hero-id">
            <h2 className="pf-hero-name">
              {profile.display}
              <span
                className={`pf-presence${online ? " is-online" : ""}`}
                title={online ? "Online" : "Offline"}
              />
            </h2>
            <span className="pf-hero-handle">@{profile.username}</span>
            <span className="pf-hero-meta">Joined {timeSince(profile.createdAt)}</span>
            <div className="pf-avatar-actions">
              <button type="button" className="secondary narrow" onClick={handleMessage}>
                Message
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="pf-split">
        <section className="pf-card pf-split-main">
          <h3>About</h3>
          <p style={{ margin: 0, color: profile.bio ? "var(--text-1)" : "var(--text-2)" }}>
            {profile.bio || "This user hasn't written a bio yet."}
          </p>
        </section>
        <RecentGames username={profile.username} />
      </div>
    </div>
  );
}

/** A compact side panel of the games a user has recently taken part in. */
function RecentGames({ username }: { username: string }) {
  const timeSince = useTimeSince();
  const [games, setGames] = useState<GameInfo[]>([]);

  useEffect(() => {
    let active = true;
    gameList()
      .then((all) => {
        if (!active) return;
        setGames(
          all
            .filter((g) => g.players.some((p) => p.username === username))
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 3),
        );
      })
      .catch(() => {
        /* best-effort */
      });
    return () => {
      active = false;
    };
  }, [username]);

  return (
    <aside className="pf-card pf-recent">
      <h3>Recent games</h3>
      {games.length === 0 ? (
        <p className="pf-recent-empty">No games yet.</p>
      ) : (
        <ul className="pf-games">
          {games.map((g) => (
            <li key={g.gameId} className="pf-game">
              <span className="pf-game-name">{gameNames[g.type]}</span>
              <span className={`pf-game-status pf-game-status--${g.status}`}>{g.status}</span>
              <span className="pf-game-time">{timeSince(g.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}

/** Preset accent colors offered by the profile color picker. */
const ACCENT_COLORS = [
  "#fecaca", // red
  "#fed7aa", // orange
  "#fef08a", // yellow
  "#bbf7d0", // green
  "#99f6e4", // teal
  "#bfdbfe", // blue
  "#c7d2fe", // indigo
  "#e9d5ff", // purple
  "#fbcfe8", // pink
  "#e5e7eb", // gray
];

/** Your own profile — fully editable. */
function OwnProfile() {
  const { user, socket } = useLoginContext();
  const timeSince = useTimeSince();
  const [showPass, setShowPass] = useState(false);
  const {
    display,
    setDisplay,
    bio,
    setBio,
    bioStatus,
    handleSaveBio,
    accent,
    accentChoice,
    setAccentChoice,
    accentStatus,
    handleSaveAccent,
    avatarUrl,
    avatarStatus,
    savingAvatar,
    handleSaveAvatar,
    handleClearAvatar,
    password,
    setPassword,
    confirm,
    setConfirm,
    err,
    handleSubmit,
  } = useEditProfileForm();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onPickAvatar = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (file) void handleSaveAvatar(file);
  };
  const { friendships } = useFriends();
  const { onlineUsers } = useOnlineStatus();
  const [showFriends, setShowFriends] = useState(false);
  const accepted = friendships?.filter((f) => f.status === "accepted") ?? [];
  const onlineCount = accepted.filter((f) => {
    const other = f.from.username === user.username ? f.to : f.from;
    return onlineUsers.has(other.username);
  }).length;
  const connected = Boolean(socket?.connected);

  // Grow the bio textarea to fit its content so typing adds rows instead of scrolling.
  const bioRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = bioRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [bio]);

  const initial = (user.display || user.username || "?").charAt(0).toUpperCase();

  return (
    <form className="pf-page" onSubmit={handleSubmit}>
      {/* ---- Hero banner (colored by the chosen banner color) ---- */}
      <header className="pf-hero">
        <div className="pf-banner" style={{ background: accent || "var(--teal-dark)" }} />
        <div className="pf-hero-body">
          <div className="pf-avatar-block">
            <button
              type="button"
              className="pf-hero-avatar"
              style={avatarUrl ? undefined : { background: accent || "var(--teal)" }}
              onClick={() => fileInputRef.current?.click()}
              disabled={savingAvatar}
              aria-label="Change avatar"
              title="Change avatar"
            >
              {avatarUrl ? (
                <img className="pf-hero-img" src={avatarUrl} alt="" />
              ) : (
                <span aria-hidden="true">{initial}</span>
              )}
              <span className="pf-avatar-edit" aria-hidden="true">
                ✏️
              </span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="visuallyHidden"
              aria-label="Choose avatar image"
              onChange={onPickAvatar}
            />
          </div>
          <div className="pf-hero-id">
            <h2 className="pf-hero-name">
              {user.display}
              <span
                className={`pf-presence${connected ? " is-online" : ""}`}
                title={connected ? "Online" : "Offline"}
              />
            </h2>
            <span className="pf-hero-handle">@{user.username}</span>
            <span className="pf-hero-meta">Joined {timeSince(user.createdAt)}</span>
            <div className="pf-avatar-actions">
              <button
                type="button"
                className="pf-friends-toggle"
                onClick={() => fileInputRef.current?.click()}
                disabled={savingAvatar}
              >
                {savingAvatar ? "Uploading…" : "Upload avatar"}
              </button>
              {avatarUrl && (
                <button
                  type="button"
                  className="pf-friends-toggle"
                  onClick={() => void handleClearAvatar()}
                  disabled={savingAvatar}
                >
                  Remove
                </button>
              )}
            </div>
            {avatarStatus && <span className="smallAndGray">{avatarStatus}</span>}
          </div>
        </div>
      </header>

      {/* ---- Stats (left) + recent games (right) ---- */}
      <div className="pf-split">
        <div className="pf-split-main pf-stats">
          <div className="pf-stat pf-stat--green">
            <div className="pf-stat-num">{accepted.length}</div>
            <div className="pf-stat-label">Friend{accepted.length === 1 ? "" : "s"}</div>
          </div>
          <div className="pf-stat pf-stat--blue">
            <div className="pf-stat-num">{onlineCount}</div>
            <div className="pf-stat-label">Online now</div>
          </div>
          <div className="pf-stat pf-stat--red">
            <div className="pf-stat-num">{connected ? "●" : "○"}</div>
            <div className="pf-stat-label">{connected ? "Connected" : "Offline"}</div>
          </div>
        </div>
        <RecentGames username={user.username} />
      </div>

      {/* ---- Settings cards ---- */}
      <div className="pf-cards">
        {/* Display name + bio */}
        <section className="pf-card">
          <h3>Profile details</h3>
          <div className="spacedSection">
            <strong>Display name</strong>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <input
                className="widefill"
                aria-label="Display name"
                value={display}
                onChange={(e) => setDisplay(e.target.value)}
              />
              <button
                className="secondary narrow"
                onClick={(e) => {
                  e.preventDefault();
                  setDisplay(user.display);
                }}
              >
                Reset
              </button>
            </div>
          </div>
          <div className="spacedSection" style={{ marginTop: "0.8rem" }}>
            <strong>Bio</strong>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
              <textarea
                ref={bioRef}
                className="widefill"
                aria-label="Bio"
                placeholder="Tell others a little about yourself"
                rows={2}
                style={{ resize: "none", overflow: "hidden" }}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
              />
              <button className="secondary narrow" onClick={handleSaveBio}>
                Save
              </button>
            </div>
            {bioStatus && <div className="smallAndGray">{bioStatus}</div>}
          </div>
        </section>

        {/* Banner color */}
        <section className="pf-card">
          <h3>Banner color</h3>
          <p className="smallAndGray" style={{ marginTop: 0 }}>
            Sets your profile banner and avatar accent.
          </p>
          <div className="pf-color-row">
            <input
              type="color"
              className="pf-color-input"
              aria-label="Pick a banner color"
              value={/^#[0-9a-fA-F]{6}$/.test(accentChoice) ? accentChoice : "#7cc4b4"}
              onChange={(e) => setAccentChoice(e.target.value)}
            />
            <span className="pf-hash" aria-hidden="true">
              #
            </span>
            <input
              type="text"
              className="widefill pf-hex"
              aria-label="Banner color hex code"
              placeholder="7cc4b4"
              value={accentChoice.replace(/^#/, "")}
              onChange={(e) => {
                const v = e.target.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 6);
                setAccentChoice(v ? `#${v}` : "");
              }}
            />
          </div>
          <div className="pf-swatches">
            {ACCENT_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={`Use banner color ${color}`}
                aria-pressed={accentChoice.toLowerCase() === color}
                onClick={() => setAccentChoice(color)}
                className={`pf-swatch${accentChoice.toLowerCase() === color ? " is-selected" : ""}`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
          <div className="pf-actions">
            <button className="secondary narrow" onClick={handleSaveAccent}>
              Save
            </button>
            <button
              className="secondary narrow"
              onClick={(e) => {
                e.preventDefault();
                setAccentChoice("");
              }}
            >
              Clear
            </button>
          </div>
          {accentStatus && <div className="smallAndGray">{accentStatus}</div>}
        </section>

        {/* Friends */}
        <section className="pf-card">
          <h3>Friends</h3>
          <button
            type="button"
            className="pf-friends-toggle"
            onClick={() => setShowFriends((v) => !v)}
            aria-expanded={showFriends}
          >
            {accepted.length} friend{accepted.length === 1 ? "" : "s"} {showFriends ? "▲" : "▼"}
          </button>
          {showFriends && (
            <ul className="pf-friends">
              {accepted.length === 0 ? (
                <li className="smallAndGray">No friends yet.</li>
              ) : (
                accepted.map((f) => {
                  const other = f.from.username === user.username ? f.to : f.from;
                  const online = onlineUsers.has(other.username);
                  return (
                    <li key={f.friendshipId} className="pf-friend">
                      <span className={`pf-dot${online ? " is-online" : ""}`} aria-hidden />
                      <NavLink to={`/profile/${other.username}`}>
                        {other.display} <span className="smallAndGray">@{other.username}</span>
                      </NavLink>
                    </li>
                  );
                })
              )}
            </ul>
          )}
        </section>

        {/* Security */}
        <section className="pf-card">
          <SecuritySettings />
        </section>

        {/* Accessibility */}
        <section className="pf-card pf-card--wide">
          <AccessibilitySettings />
        </section>

        {/* Password */}
        <section className="pf-card pf-card--wide">
          <h3>Reset password</h3>
          <div className="spacedSection">
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <input
                type={showPass ? "input" : "password"}
                className="widefill notTooWide"
                aria-label="New password"
                placeholder="New password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                className="secondary narrow"
                onClick={(e) => {
                  e.preventDefault();
                  setPassword("");
                  setConfirm("");
                }}
              >
                Reset
              </button>
              <button
                className="secondary narrow"
                aria-label="Toggle show password"
                onClick={(e) => {
                  e.preventDefault();
                  setShowPass((v) => !v);
                }}
              >
                {showPass ? "Hide" : "Reveal"}
              </button>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
              <input
                type={showPass ? "input" : "password"}
                className="widefill notTooWide"
                aria-label="Confirm new password"
                placeholder="Confirm new password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
          </div>
        </section>
      </div>

      {err && <p className="error-message">{err}</p>}
      <div className="pf-submit">
        <button className="primary narrow">Save &amp; sign out</button>
        <span className="smallAndGray">Saving your profile signs you out.</span>
      </div>
    </form>
  );
}
