import "./ChatPanel.css";
import { useRef } from "react";
import MessageCreation, { type MessageComposerHandle } from "./MessageCreation.tsx";
import MessageList from "./MessageList.tsx";
import useSocketsForChat from "../hooks/useSocketsForChat.ts";

interface ChatProps {
  chatId: string;
}

/**
 * A chat panel allows viewing and updating messages in live chat
 */
export default function ChatPanel({ chatId }: ChatProps) {
  const { messages, handleMessageCreation, deleteMessage } = useSocketsForChat(chatId);
  const composerRef = useRef<MessageComposerHandle>(null);
  return (
    messages && (
      <div className="chatContainer" id="game-chat-panel" role="region" aria-label="Game chat">
        <MessageList
          messages={messages}
          onReply={(target) => composerRef.current?.startReply(target)}
          onDelete={deleteMessage}
        />
        <MessageCreation ref={composerRef} handleMessageCreation={handleMessageCreation} />
      </div>
    )
  );
}
