import { describe, it, expect } from "vitest";
import { encodeReply, parseReply } from "../../src/util/replyQuote.ts";

describe("replyQuote", () => {
  it("round-trips an encoded reply back into quote + body", () => {
    const text = encodeReply("Doris", "Want to play Nim?", "Sure, deal me in");
    expect(parseReply(text)).toEqual({
      quote: { sender: "Doris", snippet: "Want to play Nim?" },
      body: "Sure, deal me in",
    });
  });

  it("collapses whitespace and truncates the quoted snippet to 120 chars", () => {
    const original = "a\n  b\t c " + "x".repeat(200);
    const { quote } = parseReply(encodeReply("Bob", original, "ok"));
    expect(quote?.snippet.length).toBe(120);
    expect(quote?.snippet.startsWith("a b c x")).toBe(true);
  });

  it("returns the text unchanged when there is no reply prefix", () => {
    expect(parseReply("just a normal message")).toEqual({
      quote: null,
      body: "just a normal message",
    });
  });

  it("treats a prefix with no newline as plain text (no quote)", () => {
    expect(parseReply("↪ Doris: dangling with no body")).toEqual({
      quote: null,
      body: "↪ Doris: dangling with no body",
    });
  });

  it("treats a prefix with no ': ' separator as plain text (no quote)", () => {
    const text = "↪ no-separator-here\nbody";
    expect(parseReply(text)).toEqual({ quote: null, body: text });
  });

  it("keeps body newlines that follow the quote line intact", () => {
    const text = encodeReply("Bob", "hi", "line1\nline2");
    expect(parseReply(text).body).toBe("line1\nline2");
  });
});
