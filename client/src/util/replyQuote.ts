/**
 * Lightweight reply-quoting that needs no backend changes: the quoted message
 * is carried inline at the front of the text behind a sentinel, then parsed
 * back out for display. Used by both chat (DM / game) and the forum.
 *
 * Wire format: `↪ {sender}: {snippet}\n{body}`
 */
const REPLY_PREFIX = "↪ ";

export interface ReplyQuote {
  sender: string;
  snippet: string;
}

/** Wrap `body` so it carries a quote of the message being replied to. */
export function encodeReply(sender: string, original: string, body: string): string {
  const snippet = original.replace(/\s+/g, " ").trim().slice(0, 120);
  return `${REPLY_PREFIX}${sender}: ${snippet}\n${body}`;
}

/** Split a stored message into its optional quote and the actual body text. */
export function parseReply(text: string): { quote: ReplyQuote | null; body: string } {
  if (text.startsWith(REPLY_PREFIX)) {
    const newline = text.indexOf("\n");
    if (newline !== -1) {
      const head = text.slice(REPLY_PREFIX.length, newline);
      const sep = head.indexOf(": ");
      if (sep !== -1) {
        return {
          quote: { sender: head.slice(0, sep), snippet: head.slice(sep + 2) },
          body: text.slice(newline + 1),
        };
      }
    }
  }
  return { quote: null, body: text };
}
