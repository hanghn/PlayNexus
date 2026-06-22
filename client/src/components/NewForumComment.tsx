import "./NewForumComment.css";
import { forwardRef, useImperativeHandle, useRef } from "react";
import type { ThreadInfo } from "@gamenite/shared";
import useNewCommentForm, { type CommentReplyTarget } from "../hooks/useNewCommentForm.ts";
import EmojiPicker from "./EmojiPicker.tsx";

interface NewForumCommentProps {
  threadId: string;
  firstPost: boolean;
  setThread: (newThread: ThreadInfo) => void;
}

/** Imperative handle so the thread page can target a specific comment to reply to. */
export interface CommentComposerHandle {
  startReply: (target: CommentReplyTarget) => void;
}

/**
 * Reddit-style comment composer: a bordered box that, when replying, swaps its
 * placeholder to "Reply to {user}" and shows a small header. A bottom toolbar
 * holds the emoji picker (left) and the submit button (right).
 */
const NewForumComment = forwardRef<CommentComposerHandle, NewForumCommentProps>(
  ({ threadId, firstPost, setThread }, ref) => {
    const { comment, setComment, replyTo, setReplyTo, err, handleSubmit, handleInputChange } =
      useNewCommentForm(threadId, firstPost, setThread);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useImperativeHandle(ref, () => ({
      startReply: (target: CommentReplyTarget) => {
        setReplyTo(target);
        textareaRef.current?.focus();
      },
    }));

    const placeholder = replyTo
      ? `Reply to ${replyTo.sender}`
      : firstPost
        ? "Be the first to comment"
        : "Add a comment";

    return (
      <form className="redditBox" onSubmit={handleSubmit}>
        {replyTo && (
          <div className="redditBox-replyTo">
            <span>
              Replying to <strong>{replyTo.sender}</strong>
            </span>
            <button
              type="button"
              className="redditBox-cancel"
              aria-label="Cancel reply"
              onClick={() => setReplyTo(null)}
            >
              Cancel
            </button>
          </div>
        )}
        <textarea
          ref={textareaRef}
          className="redditBox-input"
          aria-label={replyTo ? `Reply to ${replyTo.sender}` : "Add a comment"}
          placeholder={placeholder}
          value={comment}
          onChange={handleInputChange}
        />
        {err && <p className="error-message">{err}</p>}
        <div className="redditBox-toolbar">
          <EmojiPicker large onSelect={(emoji) => setComment((c) => c + emoji)} />
          <button className="redditBox-submit" disabled={comment.trim() === ""}>
            Comment
          </button>
        </div>
      </form>
    );
  },
);
NewForumComment.displayName = "NewForumComment";

export default NewForumComment;
