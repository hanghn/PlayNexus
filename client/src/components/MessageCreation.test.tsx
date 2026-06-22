// @vitest-environment jsdom
import { createRef } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import MessageCreation, { type MessageComposerHandle } from "./MessageCreation.tsx";

describe("MessageCreation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the composer with a disabled send button when empty", () => {
    render(<MessageCreation handleMessageCreation={vi.fn()} />);
    expect(screen.getByTestId("message-creation-form")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveValue("");
    expect(screen.getByLabelText("Send message")).toBeDisabled();
  });

  it("enables send once text is entered and submits trimmed body", () => {
    const handleMessageCreation = vi.fn();
    render(<MessageCreation handleMessageCreation={handleMessageCreation} />);

    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "  hello world  " } });

    const send = screen.getByLabelText("Send message");
    expect(send).toBeEnabled();

    fireEvent.submit(screen.getByTestId("message-creation-form"));

    expect(handleMessageCreation).toHaveBeenCalledTimes(1);
    expect(handleMessageCreation).toHaveBeenCalledWith("hello world");
    // input clears after sending
    expect(textarea).toHaveValue("");
  });

  it("does not send when the trimmed body is empty", () => {
    const handleMessageCreation = vi.fn();
    render(<MessageCreation handleMessageCreation={handleMessageCreation} />);

    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "    " } });
    fireEvent.submit(screen.getByTestId("message-creation-form"));

    expect(handleMessageCreation).not.toHaveBeenCalled();
  });

  it("sends on Enter without shift", () => {
    const handleMessageCreation = vi.fn();
    render(<MessageCreation handleMessageCreation={handleMessageCreation} />);

    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "ping" } });
    fireEvent.keyDown(textarea, { code: "Enter", shiftKey: false });

    expect(handleMessageCreation).toHaveBeenCalledWith("ping");
  });

  it("does not send on Shift+Enter (inserts newline instead)", () => {
    const handleMessageCreation = vi.fn();
    render(<MessageCreation handleMessageCreation={handleMessageCreation} />);

    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "line" } });
    fireEvent.keyDown(textarea, { code: "Enter", shiftKey: true });

    expect(handleMessageCreation).not.toHaveBeenCalled();
  });

  it("inserts an emoji from the picker into the text", () => {
    render(<MessageCreation handleMessageCreation={vi.fn()} />);

    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "hi " } });

    // Open the emoji picker and select an emoji.
    fireEvent.click(screen.getByLabelText("Insert emoji"));
    fireEvent.click(screen.getByLabelText("Emoji 👍"));

    expect(textarea).toHaveValue("hi 👍");
  });

  it("shows a reply banner via the imperative handle and encodes the reply on send", () => {
    const handleMessageCreation = vi.fn();
    const ref = createRef<MessageComposerHandle>();
    render(<MessageCreation ref={ref} handleMessageCreation={handleMessageCreation} />);

    // Parent triggers a reply target.
    act(() => {
      ref.current!.startReply({ sender: "alice", text: "original message" });
    });

    expect(screen.getByText("Replying to alice")).toBeInTheDocument();
    expect(screen.getByText("original message")).toBeInTheDocument();

    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "my reply" } });
    fireEvent.submit(screen.getByTestId("message-creation-form"));

    expect(handleMessageCreation).toHaveBeenCalledTimes(1);
    const sent = handleMessageCreation.mock.calls[0][0] as string;
    expect(sent).toContain("alice");
    expect(sent).toContain("original message");
    expect(sent).toContain("my reply");

    // Reply banner is cleared after sending.
    expect(screen.queryByText("Replying to alice")).not.toBeInTheDocument();
  });

  it("clears the reply target when the cancel button is clicked", () => {
    const ref = createRef<MessageComposerHandle>();
    render(<MessageCreation ref={ref} handleMessageCreation={vi.fn()} />);

    act(() => {
      ref.current!.startReply({ sender: "bob", text: "hey there" });
    });
    expect(screen.getByText("Replying to bob")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Cancel reply"));
    expect(screen.queryByText("Replying to bob")).not.toBeInTheDocument();
  });
});
