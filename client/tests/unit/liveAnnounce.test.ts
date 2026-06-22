import { describe, it, expect, vi, afterEach } from "vitest";
import { announce, setAnnouncer } from "../../src/lib/liveAnnounce.ts";

afterEach(() => setAnnouncer(null));

describe("liveAnnounce pub/sub", () => {
  it("is a no-op (no throw) when no announcer is registered", () => {
    setAnnouncer(null);
    expect(() => announce("nobody listening")).not.toThrow();
  });

  it("forwards a default (polite) announcement to the listener", () => {
    const spy = vi.fn();
    setAnnouncer(spy);
    announce("New message from Doris.");
    expect(spy).toHaveBeenCalledWith("New message from Doris.", false);
  });

  it("passes the assertive flag through for time-critical events", () => {
    const spy = vi.fn();
    setAnnouncer(spy);
    announce("New friend request.", true);
    expect(spy).toHaveBeenCalledWith("New friend request.", true);
  });

  it("stops delivering after the announcer is cleared", () => {
    const spy = vi.fn();
    setAnnouncer(spy);
    setAnnouncer(null);
    announce("dropped");
    expect(spy).not.toHaveBeenCalled();
  });
});
