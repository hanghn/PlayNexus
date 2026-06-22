import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import type { FriendshipInfo, GameKey, SafeUserInfo } from "@gamenite/shared";
import useLoginContext from "../hooks/useLoginContext.ts";
import useAuth from "../hooks/useAuth.ts";
import useFriends from "../hooks/useFriends.ts";
import { openDMThread } from "../services/dmService.ts";
import { createGame, sendGameInvite } from "../services/gameService.ts";
import { gameNames } from "../util/consts.ts";
import { apiErrorMessage } from "../services/api.ts";
import useOnlineStatus from "../hooks/useOnlinestatus.ts";
import "./Friends.css";

/* Deterministic accent (green / blue / red) per user so the grid uses the whole
   brand palette and avatars are easy to tell apart. */
const ACCENTS = ["var(--teal)", "var(--blue)", "var(--coral)"];
function accentFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) % 997;
  return ACCENTS[h % ACCENTS.length];
}
function Avatar({ user }: { user: SafeUserInfo }) {
  const ch = (user.display || user.username || "?").charAt(0).toUpperCase();
  // The user's chosen accent color rings their avatar everywhere it appears.
  const ring = user.accentColor ? { boxShadow: `0 0 0 2px ${user.accentColor}` } : undefined;
  if (user.avatarUrl) {
    return <img className="fr-avatar fr-avatar--img" src={user.avatarUrl} alt="" style={ring} />;
  }
  return (
    <span
      className="fr-avatar"
      style={{ background: accentFor(user.username), ...ring }}
      aria-hidden="true"
    >
      {ch}
    </span>
  );
}

function PendingCard({
  friendship,
  onRespond,
}: {
  friendship: FriendshipInfo;
  onRespond: (id: string, status: "accepted" | "rejected" | "blocked") => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handle = async (status: "accepted" | "rejected" | "blocked") => {
    setBusy(true);
    setError(null);
    try {
      await onRespond(friendship.friendshipId, status);
    } catch (err) {
      setError(apiErrorMessage(err, "Could not update this request"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="fr-card">
      <div className="fr-card-head">
        <Avatar user={friendship.from} />
        <div className="fr-card-id">
          <NavLink to={`/profile/${friendship.from.username}`} className="fr-card-name">
            {friendship.from.display}
          </NavLink>
          <span className="fr-card-handle">wants to be friends</span>
        </div>
      </div>
      <div className="fr-card-actions">
        <button className="fr-btn fr-btn--green" disabled={busy} onClick={() => handle("accepted")}>
          Accept
        </button>
        <button className="fr-btn fr-btn--muted" disabled={busy} onClick={() => handle("rejected")}>
          Decline
        </button>
        <button className="fr-btn fr-btn--red" disabled={busy} onClick={() => handle("blocked")}>
          Block
        </button>
      </div>
      {error && <p className="error-message">{error}</p>}
    </div>
  );
}

function FriendCard({
  friendship,
  myUsername,
  isOnline,
  onRemove,
}: {
  friendship: FriendshipInfo;
  myUsername: string;
  isOnline: boolean;
  onRemove: (friendshipId: string) => Promise<void>;
}) {
  const other = friendship.from.username === myUsername ? friendship.to : friendship.from;
  const auth = useAuth();
  const navigate = useNavigate();
  const [inviting, setInviting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [removing, setRemoving] = useState(false);

  const handleRemove = async () => {
    if (!window.confirm(`Unfriend ${other.display}? This also disables your DMs.`))
      return;
    setRemoving(true);
    try {
      await onRemove(friendship.friendshipId);
    } finally {
      setRemoving(false);
    }
  };

  const handleMessage = async () => {
    try {
      const thread = await openDMThread(auth, other.username);
      await navigate(`/messages/${thread.threadId}`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Failed to open DM:", err);
    }
  };

  const handleInvite = async (gameKey: GameKey) => {
    setMenuOpen(false);
    setInviting(true);
    try {
      const game = await createGame(auth, gameKey);
      await sendGameInvite(auth, other.username, game.gameId);
      await navigate(`/game/${game.gameId}`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Failed to invite to game:", err);
      setInviting(false);
    }
  };

  return (
    <div className="fr-card">
      <div className="fr-card-head">
        <span className="fr-avatar-wrap">
          <Avatar user={other} />
          <span
            className={`fr-presence${isOnline ? " is-online" : ""}`}
            title={isOnline ? "Online" : "Offline"}
          />
        </span>
        <div className="fr-card-id">
          <NavLink to={`/profile/${other.username}`} className="fr-card-name">
            {other.display}
          </NavLink>
          <span className="fr-card-handle">@{other.username}</span>
        </div>
      </div>
      <div className="fr-card-actions">
        <span className="fr-invite">
          <button
            className="fr-btn fr-btn--green"
            disabled={inviting}
            onClick={() => setMenuOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            {inviting ? "Inviting…" : "Invite ▾"}
          </button>
          {menuOpen && (
            <>
              <div className="fr-invite-backdrop" onClick={() => setMenuOpen(false)} />
              <ul className="fr-invite-menu" role="menu">
                {(Object.keys(gameNames) as GameKey[]).map((key) => (
                  <li key={key} role="none">
                    <button
                      type="button"
                      role="menuitem"
                      className="fr-invite-item"
                      onClick={() => handleInvite(key)}
                    >
                      {gameNames[key]}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </span>
        <button className="fr-btn fr-btn--blue" onClick={handleMessage}>
          Message
        </button>
        <button className="fr-btn fr-btn--red" disabled={removing} onClick={handleRemove}>
          {removing ? "Unfriending…" : "Unfriend"}
        </button>
      </div>
    </div>
  );
}

export default function Friends() {
  const { user } = useLoginContext();
  const { friendships, error, sendRequest, respond, remove } = useFriends();
  const { onlineUsers } = useOnlineStatus();
  const [toUsername, setToUsername] = useState("");
  const [requestErr, setRequestErr] = useState<string | null>(null);
  const [requestOk, setRequestOk] = useState<string | null>(null);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setRequestErr(null);
    setRequestOk(null);
    try {
      await sendRequest(toUsername.trim());
      setRequestOk(`Friend request sent to ${toUsername.trim()}`);
      setToUsername("");
    } catch (err) {
      setRequestErr(apiErrorMessage(err, "User not found"));
    }
  };

  if (error) return <div className="fr-page fr-empty">{error}</div>;
  if (!friendships) return <div className="fr-page fr-empty">Loading…</div>;

  const incoming = friendships.filter(
    (f) => f.status === "pending" && f.to.username === user.username,
  );
  const outgoing = friendships.filter(
    (f) => f.status === "pending" && f.from.username === user.username,
  );
  const accepted = friendships.filter((f) => f.status === "accepted");
  const usernameOf = (f: FriendshipInfo) =>
    f.from.username === user.username ? f.to.username : f.from.username;
  const onlineCount = accepted.filter((f) => onlineUsers.has(usernameOf(f))).length;

  return (
    <div className="fr-page">
      <header className="fr-hero">
        <div>
          <h2 className="fr-hero-title">Friends</h2>
          <p className="fr-hero-sub">
            {accepted.length} friend{accepted.length === 1 ? "" : "s"}
            {onlineCount > 0 && ` · ${onlineCount} online`}
          </p>
        </div>
        <form className="fr-add" onSubmit={handleSend}>
          <input
            className="fr-add-input"
            aria-label="Add a friend by username"
            placeholder="Add a friend by username"
            value={toUsername}
            onChange={(e) => setToUsername(e.target.value)}
          />
          <button className="fr-btn fr-btn--green" type="submit" disabled={!toUsername.trim()}>
            Add
          </button>
        </form>
      </header>

      {requestErr && <p className="error-message">{requestErr}</p>}
      {requestOk && <p className="fr-ok">{requestOk}</p>}

      {incoming.length > 0 && (
        <section className="fr-section">
          <h3 className="fr-section-title">
            Requests <span className="fr-count">{incoming.length}</span>
          </h3>
          <div className="fr-grid">
            {incoming.map((f) => (
              <PendingCard key={f.friendshipId} friendship={f} onRespond={respond} />
            ))}
          </div>
        </section>
      )}

      <section className="fr-section">
        <h3 className="fr-section-title">
          Your friends {accepted.length > 0 && <span className="fr-count">{accepted.length}</span>}
        </h3>
        {accepted.length === 0 ? (
          <div className="fr-empty">No friends yet — add someone by username above.</div>
        ) : (
          <div className="fr-grid">
            {accepted.map((f) => (
              <FriendCard
                key={f.friendshipId}
                friendship={f}
                myUsername={user.username}
                isOnline={onlineUsers.has(usernameOf(f))}
                onRemove={remove}
              />
            ))}
          </div>
        )}
      </section>

      {outgoing.length > 0 && (
        <section className="fr-section">
          <h3 className="fr-section-title">Pending sent</h3>
          <div className="fr-grid">
            {outgoing.map((f) => (
              <div key={f.friendshipId} className="fr-card fr-card--ghost">
                <div className="fr-card-head">
                  <Avatar user={f.to} />
                  <div className="fr-card-id">
                    <NavLink to={`/profile/${f.to.username}`} className="fr-card-name">
                      {f.to.display}
                    </NavLink>
                    <span className="fr-card-handle">awaiting response…</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
