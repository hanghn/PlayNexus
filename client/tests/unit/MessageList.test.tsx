// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import type { SafeUserInfo } from "@gamenite/shared";
import MessageList from "../../src/components/MessageList.tsx";
import type { ChatMessage } from "../../src/util/types.ts";
import { encodeReply } from "../../src/util/replyQuote.ts";

const bob: SafeUserInfo = { username: "bob", display: "Bob", createdAt: new Date() };
const doris: SafeUserInfo = { username: "doris", display: "Doris", createdAt: new Date() };

vi.mock("../../src/hooks/useLoginContext.ts", () => ({
  default: () => ({ user: bob, reset: () => undefined }),
}));
vi.mock("../../src/hooks/useAccessibility.ts", () => ({
  default: () => ({ speak: vi.fn(), speechSupported: true }),
}));
vi.mock("../../src/hooks/useTimeSince.ts", () => ({
  default: () => () => "just now",
}));

afterEach(() => cleanup());

const msg = (id: string, who: SafeUserInfo, text: string): ChatMessage => ({
  messageId: id,
  text,
  createdBy: who,
  createdAt: new Date(),
});

describe("MessageList per-message actions", () => {
  it("offers a delete button only for your own messages, as a real button", () => {
    render(
      <MessageList
        messages={[msg("m1", bob, "mine"), msg("m2", doris, "theirs")]}
        onDelete={vi.fn()}
      />,
    );
    const del = screen.getAllByLabelText("Delete your message");
    // Only Bob's own message gets a delete control...
    expect(del).toHaveLength(1);
    // ...and it's a native <button>, so Enter/Space activate it by keyboard.
    expect(del[0].tagName).toBe("BUTTON");
  });

  it("fires onDelete with the message id when the delete button is activated", () => {
    const onDelete = vi.fn();
    render(<MessageList messages={[msg("m1", bob, "mine")]} onDelete={onDelete} />);
    fireEvent.click(screen.getByLabelText("Delete your message"));
    expect(onDelete).toHaveBeenCalledWith("m1");
  });

  it("offers a reply button for every message and fires onReply", () => {
    const onReply = vi.fn();
    render(
      <MessageList
        messages={[msg("m1", bob, "mine"), msg("m2", doris, "theirs")]}
        onReply={onReply}
      />,
    );
    const replies = screen.getAllByLabelText(/^Reply to /);
    expect(replies).toHaveLength(2);
    fireEvent.click(screen.getByLabelText("Reply to Doris"));
    expect(onReply).toHaveBeenCalledWith({ sender: "Doris", text: "theirs" });
  });

  it("does not render delete controls when no onDelete handler is given", () => {
    render(<MessageList messages={[msg("m1", bob, "mine")]} />);
    expect(screen.queryByLabelText("Delete your message")).toBeNull();
  });

  it("renders the quoted message above a reply", () => {
    render(<MessageList messages={[msg("m1", bob, encodeReply("Doris", "play Nim?", "sure"))]} />);
    expect(screen.getByText("Doris")).toBeTruthy();
    expect(screen.getByText("play Nim?")).toBeTruthy();
    expect(screen.getByText("sure")).toBeTruthy();
  });

  it("renders join/leave meta rows", () => {
    const messages: ChatMessage[] = [
      { messageId: "x1", meta: "entered", dateTime: new Date(), user: doris },
    ];
    render(<MessageList messages={messages} />);
    expect(screen.getByText(/entered/)).toBeTruthy();
  });
});
