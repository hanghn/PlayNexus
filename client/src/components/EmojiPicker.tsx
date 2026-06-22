import { useState } from "react";
import "./EmojiPicker.css";

/** A small curated set of common emojis, grouped for quick scanning. */
const EMOJI_GROUPS: { label: string; emojis: string[] }[] = [
  {
    label: "Smileys",
    emojis: [
      "😀",
      "😄",
      "😁",
      "😆",
      "😅",
      "🤣",
      "😂",
      "🙂",
      "😉",
      "😊",
      "😍",
      "😘",
      "😎",
      "🤩",
      "🥳",
      "😏",
      "😴",
      "😭",
      "😡",
      "🤔",
    ],
  },
  {
    label: "Gestures",
    emojis: ["👍", "👎", "👏", "🙌", "🙏", "🤝", "💪", "👋", "🤙", "✌️"],
  },
  {
    label: "Hearts & symbols",
    emojis: ["❤️", "🔥", "⭐", "✨", "🎉", "🎊", "💯", "✅", "❌", "⚡"],
  },
  {
    label: "Games & fun",
    emojis: ["🎮", "🃏", "♠️", "♥️", "♦️", "♣️", "🎲", "🏆", "🥇", "🍀"],
  },
];

/**
 * An emoji button that opens a popover of common emojis. Selecting one calls
 * `onSelect` (the caller inserts it into its input). Used across all of the
 * site's composers.
 */
export default function EmojiPicker({
  onSelect,
  large = false,
}: {
  onSelect: (emoji: string) => void;
  /** Render a bigger button + wider panel (used in the forum composer). */
  large?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <span className={`emojiPicker${large ? " emojiPicker--lg" : ""}`}>
      <button
        type="button"
        className="emojiPicker-btn"
        aria-label="Insert emoji"
        aria-expanded={open}
        title="Insert emoji"
        onClick={() => setOpen((o) => !o)}
      >
        😊
      </button>
      {open && (
        <>
          <div className="emojiPicker-backdrop" onClick={() => setOpen(false)} />
          <div className="emojiPicker-pop" role="menu" aria-label="Emoji picker">
            {EMOJI_GROUPS.map((group) => (
              <div className="emojiPicker-group" key={group.label}>
                <div className="emojiPicker-group-label">{group.label}</div>
                <div className="emojiPicker-grid">
                  {group.emojis.map((emoji) => (
                    <button
                      type="button"
                      key={emoji}
                      className="emojiPicker-emoji"
                      aria-label={`Emoji ${emoji}`}
                      onClick={() => {
                        onSelect(emoji);
                        setOpen(false);
                      }}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </span>
  );
}
