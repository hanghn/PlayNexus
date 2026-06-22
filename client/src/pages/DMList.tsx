import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import useLoginContext from "../hooks/useLoginContext.ts";
import useAuth from "../hooks/useAuth.ts";
import useDMList from "../hooks/useDMList.ts";
import useUnread from "../hooks/useUnread.ts";
import { openDMThread } from "../services/dmService.ts";
import { apiErrorMessage } from "../services/api.ts";
import type { DMThreadInfo } from "@gamenite/shared";
import DMThread from "./DMThread.tsx";
import "./Messages.css";

/* Deterministic accent (green / blue / red) per user, matching the Friends grid. */
const ACCENTS = ["var(--teal)", "var(--blue)", "var(--coral)"];
function accentFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) % 997;
  return ACCENTS[h % ACCENTS.length];
}

function ThreadRow({
  thread,
  myUsername,
  active,
  unread,
  onOpen,
}: {
  thread: DMThreadInfo;
  myUsername: string;
  active: boolean;
  unread: number;
  onOpen: () => void;
}) {
  const navigate = useNavigate();
  const other =
    thread.participants.find((p) => p.username !== myUsername) ?? thread.participants[0];
  const last = thread.messages.at(-1);
  const initial = (other.display || other.username || "?").charAt(0).toUpperCase();

  return (
    <li>
      <button
        type="button"
        className={`dm-row${active ? " is-active" : ""}`}
        onClick={() => {
          onOpen();
          void navigate(`/messages/${thread.threadId}`);
        }}
      >
        {other.avatarUrl ? (
          <img
            className="dm-row-avatar dm-avatar-img"
            src={other.avatarUrl}
            alt=""
            style={other.accentColor ? { boxShadow: `0 0 0 2px ${other.accentColor}` } : undefined}
          />
        ) : (
          <span
            className="dm-row-avatar"
            style={{
              background: accentFor(other.username),
              ...(other.accentColor ? { boxShadow: `0 0 0 2px ${other.accentColor}` } : {}),
            }}
          >
            {initial}
          </span>
        )}
        <span className="dm-row-body">
          <span className="dm-row-name">{other.display}</span>
          {last ? (
            <span className="dm-row-preview">
              {last.createdBy.username === myUsername ? "You: " : ""}
              {last.text}
            </span>
          ) : (
            <span className="dm-row-preview dm-row-preview--empty">No messages yet</span>
          )}
        </span>
        {unread > 0 && (
          <span className="dm-row-badge" aria-label={`${unread} unread`}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
    </li>
  );
}

export default function DMList() {
  const { user } = useLoginContext();
  const auth = useAuth();
  const { threads, error } = useDMList();
  const { counts, markThreadRead } = useUnread();
  const navigate = useNavigate();
  const { threadId } = useParams<{ threadId: string }>();
  const [toUsername, setToUsername] = useState("");
  const [openErr, setOpenErr] = useState<string | null>(null);

  const handleOpen = async (e: React.FormEvent) => {
    e.preventDefault();
    setOpenErr(null);
    try {
      const thread = await openDMThread(auth, toUsername.trim());
      setToUsername("");
      await navigate(`/messages/${thread.threadId}`);
    } catch (err) {
      setOpenErr(apiErrorMessage(err, "User not found"));
    }
  };

  if (error) return <div className="dm-page dm-page--state">{error}</div>;

  return (
    <div className={`dm-page${threadId ? " has-open" : ""}`}>
      <aside className="dm-inbox">
        <header className="dm-inbox-head">
          <h2 className="dm-inbox-title">Messages</h2>
          <form className="dm-new" onSubmit={handleOpen}>
            <input
              className="dm-new-input"
              aria-label="Message a username"
              placeholder="Message a username…"
              value={toUsername}
              onChange={(e) => setToUsername(e.target.value)}
            />
            <button className="dm-new-btn" type="submit" disabled={!toUsername.trim()}>
              Go
            </button>
          </form>
          {openErr && <p className="error-message">{openErr}</p>}
        </header>

        <ul className="dm-threads">
          {!threads ? (
            <li className="dm-inbox-note">Loading…</li>
          ) : threads.length === 0 ? (
            <li className="dm-inbox-note">No conversations yet — message someone above.</li>
          ) : (
            threads.map((t) => (
              <ThreadRow
                key={t.threadId}
                thread={t}
                myUsername={user.username}
                active={t.threadId === threadId}
                unread={counts[t.threadId] ?? 0}
                onOpen={() => markThreadRead(t.threadId)}
              />
            ))
          )}
        </ul>
      </aside>

      <section className="dm-pane-wrap">
        {threadId ? (
          <DMThread key={threadId} threadId={threadId} />
        ) : (
          <div className="dm-empty">
            <span className="dm-empty-icon" aria-hidden="true">
              💬
            </span>
            <p className="dm-empty-text">Pick a conversation, or start a new one.</p>
          </div>
        )}
      </section>
    </div>
  );
}
