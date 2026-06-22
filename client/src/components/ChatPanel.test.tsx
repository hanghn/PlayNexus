// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";

expect.extend(matchers);

// --- Mock the side-effectful CSS import so it is a no-op in jsdom. ---
vi.mock("./ChatPanel.css", () => ({}));

// --- Mock the socket hook so no real socket/network is touched. ---
const handleMessageCreation = vi.fn();
const deleteMessage = vi.fn();
let mockMessages: unknown;
const useSocketsForChat = vi.fn((_chatId: string) => ({
  messages: mockMessages,
  handleMessageCreation,
  deleteMessage,
}));
vi.mock("../hooks/useSocketsForChat.ts", () => ({
  default: (chatId: string) => useSocketsForChat(chatId),
}));

// --- Mock MessageList: surfaces its props so we can assert wiring. ---
vi.mock("./MessageList.tsx", () => ({
  default: ({
    messages,
    onReply,
    onDelete,
  }: {
    messages: { messageId: string }[];
    onReply?: (t: { sender: string; text: string }) => void;
    onDelete?: (id: string) => void;
  }) => (
    <div data-testid="message-list">
      <span data-testid="message-count">{messages.length}</span>
      <button data-testid="reply-btn" onClick={() => onReply?.({ sender: "Ann", text: "hi" })}>
        reply
      </button>
      <button data-testid="delete-btn" onClick={() => onDelete?.("m1")}>
        delete
      </button>
    </div>
  ),
}));

// --- Mock MessageCreation: a forwardRef that exposes startReply on its handle. ---
const startReply = vi.fn();
vi.mock("./MessageCreation.tsx", async () => {
  const React = await import("react");
  const MessageCreation = React.forwardRef(
    (
      { handleMessageCreation: hmc }: { handleMessageCreation: (t: string) => void },
      ref: React.Ref<{ startReply: (t: { sender: string; text: string }) => void }>,
    ) => {
      React.useImperativeHandle(ref, () => ({ startReply }));
      return (
        <button data-testid="composer-send" onClick={() => hmc("hello world")}>
          send
        </button>
      );
    },
  );
  MessageCreation.displayName = "MessageCreation";
  return { default: MessageCreation };
});

import ChatPanel from "./ChatPanel.tsx";

beforeEach(() => {
  vi.clearAllMocks();
  mockMessages = null;
});

afterEach(() => {
  cleanup();
});

describe("ChatPanel", () => {
  it("renders nothing while messages are null", () => {
    mockMessages = null;
    const { container } = render(<ChatPanel chatId="c1" />);
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    expect(container.firstChild).toBeNull();
  });

  it("passes the chatId through to the socket hook", () => {
    mockMessages = [];
    render(<ChatPanel chatId="room-42" />);
    expect(useSocketsForChat).toHaveBeenCalledWith("room-42");
  });

  it("renders the chat region with its accessibility attributes once messages exist", () => {
    mockMessages = [{ messageId: "m1" }, { messageId: "m2" }];
    render(<ChatPanel chatId="c1" />);

    const region = screen.getByRole("region", { name: "Game chat" });
    expect(region).toBeInTheDocument();
    expect(region).toHaveAttribute("id", "game-chat-panel");
    expect(screen.getByTestId("message-list")).toBeInTheDocument();
    expect(screen.getByTestId("message-count")).toHaveTextContent("2");
  });

  it("forwards deletion from MessageList to the hook's deleteMessage", () => {
    mockMessages = [{ messageId: "m1" }];
    render(<ChatPanel chatId="c1" />);

    fireEvent.click(screen.getByTestId("delete-btn"));
    expect(deleteMessage).toHaveBeenCalledWith("m1");
  });

  it("forwards message creation from the composer to the hook", () => {
    mockMessages = [];
    render(<ChatPanel chatId="c1" />);

    fireEvent.click(screen.getByTestId("composer-send"));
    expect(handleMessageCreation).toHaveBeenCalledWith("hello world");
  });

  it("routes a reply click into the composer ref's startReply", () => {
    mockMessages = [{ messageId: "m1" }];
    render(<ChatPanel chatId="c1" />);

    fireEvent.click(screen.getByTestId("reply-btn"));
    expect(startReply).toHaveBeenCalledWith({ sender: "Ann", text: "hi" });
  });
});
