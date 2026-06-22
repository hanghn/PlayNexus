import "./FriendRequestBell.css";
import { useState } from "react";
import useFriendRequests from "../hooks/useFriendRequests.ts";

/**
 * A header notification bell for incoming friend requests. Shows a count badge
 * and opens a dropdown with Accept/Reject actions. Lives in the header so it's
 * reachable from every page, not just the lobby.
 */
export default function FriendRequestBell() {
  const { incomingRequests, acceptFriendRequest, rejectFriendRequest } = useFriendRequests();
  const [open, setOpen] = useState(false);
  const count = incomingRequests.length;

  return (
    <div className="fr-bell">
      <button
        type="button"
        className="fr-bell-btn"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={count > 0 ? `Friend requests, ${count} pending` : "Friend requests"}
        title="Friend requests"
      >
        <span className="fr-bell-icon" aria-hidden="true">
          🔔
        </span>
        {count > 0 && (
          <span className="fr-bell-badge" aria-hidden="true">
            {count}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fr-bell-backdrop" onClick={() => setOpen(false)} />
          <div className="fr-bell-menu" role="menu">
            <div className="fr-bell-head">Friend Requests ({count})</div>
            {count === 0 ? (
              <p className="fr-bell-empty">No pending friend requests.</p>
            ) : (
              <ul className="fr-bell-list">
                {incomingRequests.map((request) => (
                  <li key={request.friendshipId} className="fr-bell-item">
                    <span className="fr-bell-name">
                      <strong>{request.from.display}</strong>{" "}
                      <span className="fr-bell-handle">@{request.from.username}</span>
                    </span>
                    <span className="fr-bell-actions">
                      <button
                        type="button"
                        className="fr-accept"
                        onClick={() => acceptFriendRequest(request.friendshipId)}
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        className="fr-reject"
                        onClick={() => rejectFriendRequest(request.friendshipId)}
                      >
                        Reject
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
