// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { describe, it, expect, afterEach, vi } from "vitest";
import type { MessageInfo } from "@gamenite/shared";

const mocks = vi.hoisted(() => ({
  messages: null as MessageInfo[] | null,
  handleMessageCreation: vi.fn(),
  deleteMessage: vi.fn(),
  startReply: vi.fn(),
}));

vi.mock("../../src/hooks/useSocketsForChat.ts", () => ({
  default: () => ({
    messages: mocks.messages,
    handleMessageCreation: mocks.handleMessageCreation,
    deleteMessage: mocks.deleteMessage,
  }),
}));

// Stub the heavy children so we test ChatPanel's wiring in isolation.
vi.mock("../../src/components/MessageList.tsx", () => ({
  default: ({
    messages,
    onReply,
    onDelete,
  }: {
    messages: unknown[];
    onReply: (target: { id: string }) => void;
    onDelete: (id: string) => void;
  }) => (
    <div data-testid="message-list">
      <span>count:{messages.length}</span>
      <button onClick={() => onReply({ id: "m1" })}>reply</button>
      <button onClick={() => onDelete("m1")}>delete</button>
    </div>
  ),
}));

vi.mock("../../src/components/MessageCreation.tsx", () => ({
  default: vi.fn(() => <div data-testid="composer" />),
}));

import ChatPanel from "../../src/components/ChatPanel.tsx";

afterEach(() => {
  cleanup();
  mocks.messages = null;
  vi.clearAllMocks();
});

describe("ChatPanel", () => {
  it("renders nothing until messages have loaded", () => {
    mocks.messages = null;
    const { container } = render(<ChatPanel chatId="c1" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the chat region with the message list and composer once loaded", () => {
    mocks.messages = [{ id: "m1" } as unknown as MessageInfo];
    render(<ChatPanel chatId="c1" />);

    expect(screen.getByRole("region", { name: "Game chat" })).toBeInTheDocument();
    expect(screen.getByTestId("message-list")).toHaveTextContent("count:1");
    expect(screen.getByTestId("composer")).toBeInTheDocument();
  });

  it("forwards delete actions to the socket hook", () => {
    mocks.messages = [{ id: "m1" } as unknown as MessageInfo];
    render(<ChatPanel chatId="c1" />);

    fireEvent.click(screen.getByText("delete"));
    expect(mocks.deleteMessage).toHaveBeenCalledWith("m1");
    // Replying through the list invokes the composer ref handle without throwing.
    fireEvent.click(screen.getByText("reply"));
  });
});
