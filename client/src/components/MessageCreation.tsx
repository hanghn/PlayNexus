import "./MessageCreation.css";
import {
  type SubmitEvent,
  type KeyboardEvent,
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import EmojiPicker from "./EmojiPicker.tsx";
import { encodeReply } from "../util/replyQuote.ts";

interface MessageCreationProps {
  handleMessageCreation: (text: string) => void;
}

/** A message being replied to (its author + text). */
export interface ReplyTarget {
  sender: string;
  text: string;
}

/** Imperative handle exposed to parents so "Reply" can target this composer. */
export interface MessageComposerHandle {
  startReply: (target: ReplyTarget) => void;
}

const MessageCreation = forwardRef<MessageComposerHandle, MessageCreationProps>(
  ({ handleMessageCreation }, ref) => {
    const [text, setText] = useState<string>("");
    const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // A parent calls this (from a "Reply" click) to set the reply target and
    // focus the input. Driven by an event, not an effect, so it never clobbers
    // what the user is typing.
    useImperativeHandle(ref, () => ({
      startReply: (target: ReplyTarget) => {
        setReplyTo(target);
        textareaRef.current?.focus();
      },
    }));

    const send = () => {
      const body = text.trim();
      if (!body) return;
      handleMessageCreation(replyTo ? encodeReply(replyTo.sender, replyTo.text, body) : body);
      setText("");
      setReplyTo(null);
    };

    function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
      if (e.code === "Enter" && !e.shiftKey) {
        e.preventDefault(); // Don't insert a newline
        send();
      }
    }

    function handleSubmit(e: SubmitEvent) {
      e.preventDefault();
      send();
    }

    const insertEmoji = (emoji: string) => {
      setText((t) => t + emoji);
      textareaRef.current?.focus();
    };

    const canSend = text.trim() !== "";

    return (
      <form data-testid="message-creation-form" className="messageCreation" onSubmit={handleSubmit}>
        {replyTo && (
          <div className="composer-reply">
            <span className="composer-reply-bar" aria-hidden="true" />
            <div className="composer-reply-text">
              <span className="composer-reply-to">Replying to {replyTo.sender}</span>
              <span className="composer-reply-snippet">{replyTo.text}</span>
            </div>
            <button
              type="button"
              className="composer-reply-cancel"
              aria-label="Cancel reply"
              onClick={() => setReplyTo(null)}
            >
              ✕
            </button>
          </div>
        )}
        <div className="composer">
          <EmojiPicker onSelect={insertEmoji} />
          <textarea
            ref={textareaRef}
            className="composer-input"
            aria-label="Message"
            placeholder="Message"
            rows={1}
            value={text}
            onKeyDown={handleKeyDown}
            onChange={(e) => setText(e.target.value)}
          ></textarea>
          <button
            type="submit"
            className="composer-send"
            aria-label="Send message"
            disabled={!canSend}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M12 20V5M12 5l-6 6M12 5l6 6"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </form>
    );
  },
);
MessageCreation.displayName = "MessageCreation";

export default MessageCreation;
