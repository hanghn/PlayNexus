// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import EmojiPicker from "./EmojiPicker";

describe("EmojiPicker", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("renders the toggle button collapsed by default", () => {
    render(<EmojiPicker onSelect={() => {}} />);
    const btn = screen.getByRole("button", { name: "Insert emoji" });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("does not apply the large modifier class by default", () => {
    const { container } = render(<EmojiPicker onSelect={() => {}} />);
    const span = container.querySelector("span.emojiPicker");
    expect(span).toBeInTheDocument();
    expect(span).not.toHaveClass("emojiPicker--lg");
  });

  it("applies the large modifier class when large is true", () => {
    const { container } = render(<EmojiPicker onSelect={() => {}} large />);
    const span = container.querySelector("span.emojiPicker");
    expect(span).toHaveClass("emojiPicker--lg");
  });

  it("opens the popover when the toggle button is clicked", () => {
    render(<EmojiPicker onSelect={() => {}} />);
    const btn = screen.getByRole("button", { name: "Insert emoji" });
    fireEvent.click(btn);

    expect(btn).toHaveAttribute("aria-expanded", "true");
    const menu = screen.getByRole("menu", { name: "Emoji picker" });
    expect(menu).toBeInTheDocument();
  });

  it("renders all emoji group labels and emojis when open", () => {
    render(<EmojiPicker onSelect={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Insert emoji" }));

    for (const label of ["Smileys", "Gestures", "Hearts & symbols", "Games & fun"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    // 20 + 10 + 10 + 10 = 50 emoji buttons, plus the toggle button.
    const emojiButtons = screen
      .getAllByRole("button")
      .filter((b) => b.getAttribute("aria-label")?.startsWith("Emoji "));
    expect(emojiButtons).toHaveLength(50);
  });

  it("toggles closed when the button is clicked twice", () => {
    render(<EmojiPicker onSelect={() => {}} />);
    const btn = screen.getByRole("button", { name: "Insert emoji" });
    fireEvent.click(btn);
    expect(screen.getByRole("menu")).toBeInTheDocument();
    fireEvent.click(btn);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(btn).toHaveAttribute("aria-expanded", "false");
  });

  it("calls onSelect with the emoji and closes the popover when an emoji is clicked", () => {
    const onSelect = vi.fn();
    render(<EmojiPicker onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: "Insert emoji" }));

    fireEvent.click(screen.getByRole("button", { name: "Emoji 😀" }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("😀");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("closes the popover when the backdrop is clicked without calling onSelect", () => {
    const onSelect = vi.fn();
    const { container } = render(<EmojiPicker onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: "Insert emoji" }));

    const backdrop = container.querySelector(".emojiPicker-backdrop");
    expect(backdrop).toBeInTheDocument();
    fireEvent.click(backdrop!);

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(onSelect).not.toHaveBeenCalled();
  });
});
