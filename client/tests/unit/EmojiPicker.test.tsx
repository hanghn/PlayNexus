// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { describe, it, expect, afterEach, vi } from "vitest";
import EmojiPicker from "../../src/components/EmojiPicker.tsx";

afterEach(cleanup);

describe("EmojiPicker", () => {
  it("starts closed and opens the popover on click", () => {
    render(<EmojiPicker onSelect={vi.fn()} />);
    const trigger = screen.getByRole("button", { name: "Insert emoji" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("menu", { name: "Emoji picker" })).toBeInTheDocument();
    // Group labels render.
    expect(screen.getByText("Smileys")).toBeInTheDocument();
  });

  it("selects an emoji and closes the popover", () => {
    const onSelect = vi.fn();
    render(<EmojiPicker onSelect={onSelect} />);

    fireEvent.click(screen.getByRole("button", { name: "Insert emoji" }));
    fireEvent.click(screen.getByRole("button", { name: "Emoji 🎮" }));

    expect(onSelect).toHaveBeenCalledWith("🎮");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("toggles closed again when the trigger is clicked twice", () => {
    render(<EmojiPicker onSelect={vi.fn()} />);
    const trigger = screen.getByRole("button", { name: "Insert emoji" });
    fireEvent.click(trigger);
    fireEvent.click(trigger);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("closes when the backdrop is clicked", () => {
    const { container } = render(<EmojiPicker onSelect={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Insert emoji" }));

    const backdrop = container.querySelector(".emojiPicker-backdrop");
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop!);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("applies the large modifier class when large is set", () => {
    const { container } = render(<EmojiPicker onSelect={vi.fn()} large />);
    expect(container.querySelector(".emojiPicker")).toHaveClass("emojiPicker--lg");
  });
});
