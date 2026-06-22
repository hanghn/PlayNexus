// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import useKeyboardNav from "./useKeyboardNav";

function dispatchKey(key: string, target?: EventTarget) {
  const event = new KeyboardEvent("keydown", { key, cancelable: true });
  if (target) {
    Object.defineProperty(event, "target", { value: target, configurable: true });
  }
  window.dispatchEvent(event);
  return event;
}

describe("useKeyboardNav", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fires the matching binding for a pressed key", () => {
    const handler = vi.fn();
    renderHook(() => useKeyboardNav({ "1": handler }));

    const div = document.createElement("div");
    document.body.appendChild(div);
    dispatchKey("1", div);

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("calls preventDefault when a binding fires", () => {
    const handler = vi.fn();
    renderHook(() => useKeyboardNav({ ArrowRight: handler }));

    const div = document.createElement("div");
    document.body.appendChild(div);
    const event = dispatchKey("ArrowRight", div);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it("does nothing for unbound keys", () => {
    const handler = vi.fn();
    renderHook(() => useKeyboardNav({ "1": handler }));

    const div = document.createElement("div");
    document.body.appendChild(div);
    const event = dispatchKey("2", div);

    expect(handler).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it.each(["INPUT", "TEXTAREA", "SELECT"])("ignores keys when target is %s", (tag) => {
    const handler = vi.fn();
    renderHook(() => useKeyboardNav({ Enter: handler }));

    const el = document.createElement(tag.toLowerCase());
    document.body.appendChild(el);
    dispatchKey("Enter", el);

    expect(handler).not.toHaveBeenCalled();
  });

  it("does not register a listener when disabled", () => {
    const handler = vi.fn();
    renderHook(() => useKeyboardNav({ "1": handler }, false));

    const div = document.createElement("div");
    document.body.appendChild(div);
    dispatchKey("1", div);

    expect(handler).not.toHaveBeenCalled();
  });

  it("removes the listener on unmount", () => {
    const handler = vi.fn();
    const { unmount } = renderHook(() => useKeyboardNav({ "1": handler }));

    unmount();

    const div = document.createElement("div");
    document.body.appendChild(div);
    dispatchKey("1", div);

    expect(handler).not.toHaveBeenCalled();
  });

  it("re-registers with new bindings when they change", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(({ b }) => useKeyboardNav(b), {
      initialProps: { b: { "1": first } },
    });

    const div = document.createElement("div");
    document.body.appendChild(div);
    dispatchKey("1", div);
    expect(first).toHaveBeenCalledTimes(1);

    rerender({ b: { "1": second } });
    dispatchKey("1", div);
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).toHaveBeenCalledTimes(1);
  });
});
