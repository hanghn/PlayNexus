import { useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import useLoginContext from "../hooks/useLoginContext.ts";
import useDMThread from "../hooks/useDMThread.ts";
import MessageList from "../components/MessageList.tsx";
import MessageCreation, { type MessageComposerHandle } from "../components/MessageCreation.tsx";

/* Deterministic accent (green / blue / red) per user, matching the Friends grid. */
const ACCENTS = ["var(--teal)", "var(--blue)", "var(--coral)"];
function accentFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) % 997;
  return ACCENTS[h % ACCENTS.length];
}

/**
 * The conversation pane. Rendered on the right of the Messages split (DMList),
 * which passes `threadId`; it also falls back to the route param so it still
 * works as a standalone page.
 */
export default function DMThread({ threadId: propThreadId }: { threadId?: string }) {
  const params = useParams<{ threadId: string }>();
  const threadId = propThreadId ?? params.threadId ?? "";
  const { user } = useLoginContext();
  const navigate = useNavigate();
  const { thread, error, send, deleteMessage } = useDMThread(threadId);
  const composerRef = useRef<MessageComposerHandle>(null);

  if (error) return <div className="dm-pane dm-pane--state">{error}</div>;
  if (!thread) return <div className="dm-pane dm-pane--state">Loading…</div>;

  const other =
    thread.participants.find((p) => p.username !== user.username) ?? thread.participants[0];
  const initial = (other.display || other.username || "?").charAt(0).toUpperCase();

  return (
    <div className="dm-pane">
      <div className="dm-thread-head">
        <button
          className="dm-back"
          onClick={() => navigate("/messages")}
          aria-label="Back to inbox"
        >
          ←
        </button>
        {other.avatarUrl ? (
          <img
            className="dm-thread-avatar dm-avatar-img"
            src={other.avatarUrl}
            alt=""
            style={other.accentColor ? { boxShadow: `0 0 0 2px ${other.accentColor}` } : undefined}
          />
        ) : (
          <span
            className="dm-thread-avatar"
            style={{
              background: accentFor(other.username),
              ...(other.accentColor ? { boxShadow: `0 0 0 2px ${other.accentColor}` } : {}),
            }}
            aria-hidden="true"
          >
            {initial}
          </span>
        )}
        <div className="dm-thread-id">
          <span className="dm-thread-name">{other.display}</span>
          <span className="dm-thread-handle">@{other.username}</span>
        </div>
      </div>
      <MessageList
        messages={thread.messages}
        onReply={(target) => composerRef.current?.startReply(target)}
        onDelete={deleteMessage}
      />
      <MessageCreation ref={composerRef} handleMessageCreation={send} />
    </div>
  );
}
