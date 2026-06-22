// @vitest-environment jsdom
import { render, act, cleanup } from "@testing-library/react";
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import LiveAnnouncer from "../../src/components/LiveAnnouncer.tsx";
import { announce } from "../../src/lib/liveAnnounce.ts";

beforeEach(() => {
  // LiveAnnouncer clears the region then sets it on the next animation frame so
  // an identical message re-fires; run rAF synchronously so the text settles.
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const polite = (root: HTMLElement) => root.querySelector('[aria-live="polite"]');
const assertive = (root: HTMLElement) => root.querySelector('[aria-live="assertive"]');

describe("LiveAnnouncer (ARIA-live regions)", () => {
  it("renders polite and assertive live regions that are atomic", () => {
    const { container } = render(<LiveAnnouncer />);
    expect(polite(container)).not.toBeNull();
    expect(assertive(container)).not.toBeNull();
    expect(polite(container)?.getAttribute("aria-atomic")).toBe("true");
    expect(assertive(container)?.getAttribute("aria-atomic")).toBe("true");
  });

  it("routes a normal announcement into the polite region", () => {
    const { container } = render(<LiveAnnouncer />);
    act(() => announce("New message from Doris."));
    expect(polite(container)?.textContent).toBe("New message from Doris.");
    // It must not leak into the assertive region.
    expect(assertive(container)?.textContent).toBe("");
  });

  it("routes an assertive announcement into the assertive region", () => {
    const { container } = render(<LiveAnnouncer />);
    act(() => announce("New friend request from Bob.", true));
    expect(assertive(container)?.textContent).toBe("New friend request from Bob.");
    expect(polite(container)?.textContent).toBe("");
  });

  it("re-announces an identical consecutive message (e.g. two 'Your turn.' cues)", () => {
    const { container } = render(<LiveAnnouncer />);
    act(() => announce("Your turn."));
    act(() => announce("Your turn."));
    expect(polite(container)?.textContent).toBe("Your turn.");
  });

  it("does nothing when no LiveAnnouncer is mounted (no throw)", () => {
    // announce() is a no-op if the region was never registered/unmounted.
    expect(() => announce("nobody is listening")).not.toThrow();
  });
});
