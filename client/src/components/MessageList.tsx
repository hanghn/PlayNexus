import "./MessageList.css";
import useLoginContext from "../hooks/useLoginContext.ts";
import useAccessibility from "../hooks/useAccessibility.ts";
import type { ChatMessage } from "../util/types.ts";
import { useEffect, useRef } from "react";
import useTimeSince from "../hooks/useTimeSince.ts";
import { parseReply, type ReplyQuote } from "../util/replyQuote.ts";

interface MessageListProps {
  messages: ChatMessage[];
  /** Called when the user clicks "Reply" on a message (sender + its body text). */
  onReply?: (target: { sender: string; text: string }) => void;
  /** Called when the user deletes one of their own messages. */
  onDelete?: (messageId: string) => void;
}

export default function MessageList({ messages, onReply, onDelete }: MessageListProps) {
  const { user } = useLoginContext();
  const { speak, speechSupported } = useAccessibility();
  const chatWindowRef = useRef<HTMLDivElement | null>(null);
  const timeSince = useTimeSince();
  useEffect(() => {
    if (!chatWindowRef.current) return;
    chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight;
  }, [messages]);

  /** The quoted message a reply is responding to, shown above the reply text. */
  const renderQuote = (quote: ReplyQuote | null) =>
    quote && (
      <div className="chatQuote">
        <span className="chatQuote-sender">{quote.sender}</span>
        <span className="chatQuote-snippet">{quote.snippet}</span>
      </div>
    );

  /** Per-message actions: read aloud + reply + (own messages) delete. */
  const renderActions = (body: string, sender: string, ownId?: string) => (
    <span className="chatActions">
      {speechSupported && (
        <button
          type="button"
          className="chatAction"
          aria-label={`Read message from ${sender} aloud`}
          title="Read aloud"
          onClick={() => speak(`${sender} said: ${body}`)}
        >
          🔊
        </button>
      )}
      {onReply && (
        <button
          type="button"
          className="chatAction"
          aria-label={`Reply to ${sender}`}
          title="Reply"
          onClick={() => onReply({ sender, text: body })}
        >
          ↩︎
        </button>
      )}
      {onDelete && ownId && (
        <button
          type="button"
          className="chatAction chatAction--danger"
          aria-label="Delete your message"
          title="Delete"
          onClick={() => onDelete(ownId)}
        >
          🗑
        </button>
      )}
    </span>
  );

  return (
    <div className="chatWindow" ref={chatWindowRef}>
      <div className="chatScroller">
        {messages.map((message) => {
          if ("meta" in message) {
            return (
              <div key={message.messageId} className="chatMeta">
                {user.username === message.user.username ? "you" : message.user.display}{" "}
                {message.meta}
                {" chat "}
                {timeSince(message.dateTime)}
              </div>
            );
          }
          const { quote, body } = parseReply(message.text);
          if (user.username === message.createdBy.username) {
            return (
              <div key={message.messageId} className="chatMe">
                <div className="chatSender">{timeSince(message.createdAt)}</div>
                <div className="chatContent">
                  {renderQuote(quote)}
                  <span className="chatText">{body}</span>
                  {renderActions(body, "You", message.messageId)}
                </div>
              </div>
            );
          }
          return (
            <div key={message.messageId} className="chatOther">
              <div className="chatSender">
                {message.createdBy.display} {timeSince(message.createdAt)}
              </div>
              <div className="chatContent">
                {renderQuote(quote)}
                <span className="chatText">{body}</span>
                {renderActions(body, message.createdBy.display)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
