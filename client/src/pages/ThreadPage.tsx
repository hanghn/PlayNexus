import "./Forum.css";
import { useRef } from "react";
import { useParams } from "react-router-dom";
import useThreadInfo from "../hooks/useThreadInfo.ts";
import useAuth from "../hooks/useAuth.ts";
import useLoginContext from "../hooks/useLoginContext.ts";
import NewForumComment, { type CommentComposerHandle } from "../components/NewForumComment.tsx";
import UserChip from "../components/UserChip.tsx";
import useTimeSince from "../hooks/useTimeSince.ts";
import { parseReply, type ReplyQuote } from "../util/replyQuote.ts";
import { deleteComment } from "../services/threadService.ts";

/** The quoted post/comment a reply is responding to. */
function QuotedBlock({ quote }: { quote: ReplyQuote }) {
  return (
    <div className="thread-quote">
      <span className="thread-quote-sender">{quote.sender}</span>
      <span className="thread-quote-snippet">{quote.snippet}</span>
    </div>
  );
}

export default function ThreadPage() {
  const formatTimeSince = useTimeSince();
  const { threadId } = useParams();
  const auth = useAuth();
  const { user } = useLoginContext();

  const { threadInfo, setThread } = useThreadInfo(threadId!);
  const composerRef = useRef<CommentComposerHandle>(null);

  if ("message" in threadInfo) {
    return (
      <div className="content thread-page">
        <div className="forum-empty">{threadInfo.message}</div>
      </div>
    );
  }

  const reply = (sender: string, text: string) => composerRef.current?.startReply({ sender, text });

  const removeComment = async (commentId: string) => {
    if (!window.confirm("Delete this comment?")) return;
    try {
      setThread(await deleteComment(auth, threadInfo.threadId.toString(), commentId));
    } catch {
      /* best-effort; the comment stays if the delete failed */
    }
  };

  return (
    <div className="content thread-page">
      {/* Hero: post title + body */}
      <div className="thread-hero">
        <h2 className="thread-title">{threadInfo.title}</h2>
        <p className="thread-body">{threadInfo.text}</p>
        <div className="thread-byline">
          Posted by <UserChip user={threadInfo.createdBy} size={1.4} /> ·{" "}
          {formatTimeSince(threadInfo.createdAt)}
          <button
            type="button"
            className="thread-reply-btn"
            onClick={() => reply(threadInfo.createdBy.display, threadInfo.text)}
          >
            ↩︎ Reply
          </button>
        </div>
      </div>

      {/* Comments */}
      {threadInfo.comments.length > 0 && (
        <div className="thread-comments" role="list">
          {threadInfo.comments.map(({ commentId, text, createdBy, createdAt, editedAt }) => {
            const { quote, body } = parseReply(text);
            return (
              <div className="thread-comment" role="listitem" key={commentId}>
                {quote && <QuotedBlock quote={quote} />}
                <div className="thread-comment-text">{body}</div>
                <div className="thread-comment-meta">
                  <UserChip user={createdBy} size={1.3} />
                  {createdBy.username === threadInfo.createdBy.username && (
                    <span className="thread-op-badge">OP</span>
                  )}
                  {" · "}
                  {formatTimeSince(createdAt)}
                  {editedAt && ` · edited ${formatTimeSince(editedAt)}`}
                  <button
                    type="button"
                    className="thread-reply-btn"
                    onClick={() => reply(createdBy.display, body)}
                  >
                    ↩︎ Reply
                  </button>
                  {createdBy.username === user.username && (
                    <button
                      type="button"
                      className="thread-reply-btn thread-delete-btn"
                      onClick={() => removeComment(commentId)}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Reply form */}
      <div className="thread-reply-section">
        <NewForumComment
          ref={composerRef}
          firstPost={threadInfo.comments.length === 0}
          threadId={threadInfo.threadId.toString()}
          setThread={setThread}
        />
      </div>
    </div>
  );
}
