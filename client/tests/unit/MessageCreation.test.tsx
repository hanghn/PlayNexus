// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import MessageCreation, {
  type MessageComposerHandle,
} from "../../src/components/MessageCreation.tsx";
import { encodeReply } from "../../src/util/replyQuote.ts";

vi.mock("../../src/components/EmojiPicker.tsx", () => ({
  default: ({ onSelect }: { onSelect: (emoji: string) => void }) => (
    <button type="button" onClick={() => onSelect("🙂")}>
      emoji
    </button>
  ),
}));

afterEach(() => {
  cleanup();
});

describe("MessageCreation", () => {
  it("sends trimmed text on Enter and clears the composer", () => {
    const handleMessageCreation = vi.fn();

    render(<MessageCreation handleMessageCreation={handleMessageCreation} />);

    const textarea = screen.getByLabelText("Message");
    const sendButton = screen.getByRole("button", { name: "Send message" });

    expect(sendButton.hasAttribute("disabled")).toBe(true);

    fireEvent.change(textarea, { target: { value: "  hello there  " } });
    expect(sendButton.hasAttribute("disabled")).toBe(false);

    fireEvent.keyDown(textarea, { code: "Enter", shiftKey: false });
    expect(handleMessageCreation).toHaveBeenCalledWith("hello there");
    expect((textarea as HTMLTextAreaElement).value).toBe("");
  });

  it("supports replies, emoji insertion, and submit via the send button", () => {
    const handleMessageCreation = vi.fn();
    const ref = createRef<MessageComposerHandle>();

    render(<MessageCreation ref={ref} handleMessageCreation={handleMessageCreation} />);

    act(() => {
      ref.current?.startReply({ sender: "Doris", text: "play Nim?" });
    });
    expect(screen.getByText("Replying to Doris")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "sure" } });
    fireEvent.click(screen.getByRole("button", { name: "emoji" }));
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    expect(handleMessageCreation).toHaveBeenCalledWith(encodeReply("Doris", "play Nim?", "sure🙂"));
    expect(screen.queryByText("Replying to Doris")).toBeNull();

    expect((screen.getByLabelText("Message") as HTMLInputElement).value).toBe("");
  });
});
