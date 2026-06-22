// @vitest-environment jsdom
import { render, act, cleanup, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import useArrowFocusNav from "../../src/hooks/useArrowFocusNav.ts";

function Host({ enabled }: { enabled: boolean }) {
  useArrowFocusNav(enabled);
  return (
    <div>
      <button>One</button>
      <button>Two</button>
      <button>Three</button>
      <input aria-label="field" />
    </div>
  );
}

beforeEach(() => {
  // jsdom does no layout, so getClientRects() is empty and the hook's
  // visibility filter would drop everything; pretend each element is painted.
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([
    { width: 10, height: 10 },
  ] as unknown as DOMRectList);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const active = () => (document.activeElement as HTMLElement | null)?.textContent;
const arrow = (key: string) => act(() => void fireEvent.keyDown(window, { key }));

describe("useArrowFocusNav", () => {
  it("moves focus forward on ArrowDown / ArrowRight", () => {
    const { getByText } = render(<Host enabled />);
    getByText("One").focus();
    arrow("ArrowDown");
    expect(active()).toBe("Two");
    arrow("ArrowRight");
    expect(active()).toBe("Three");
  });

  it("moves focus backward and wraps on ArrowUp / ArrowLeft", () => {
    const { getByText } = render(<Host enabled />);
    getByText("One").focus();
    arrow("ArrowUp"); // wraps to the last focusable (the input)
    expect(document.activeElement?.tagName).toBe("INPUT");
  });

  it("Home and End jump to the first and last focusable", () => {
    const { getByText } = render(<Host enabled />);
    getByText("Three").focus();
    arrow("Home");
    expect(active()).toBe("One");
    arrow("End"); // from a button, so it isn't skipped as an editable field
    expect(document.activeElement?.tagName).toBe("INPUT");
  });

  it("does nothing while a text field is focused (so typing/sliders work)", () => {
    const { getByLabelText } = render(<Host enabled />);
    const input = getByLabelText("field");
    input.focus();
    arrow("ArrowDown");
    expect(document.activeElement).toBe(input);
  });

  it("ignores arrow keys when a modifier is held", () => {
    const { getByText } = render(<Host enabled />);
    getByText("One").focus();
    act(() => void fireEvent.keyDown(window, { key: "ArrowDown", altKey: true }));
    expect(active()).toBe("One");
  });

  it("is inert when disabled", () => {
    const { getByText } = render(<Host enabled={false} />);
    getByText("One").focus();
    arrow("ArrowDown");
    expect(active()).toBe("One");
  });
});

function ShellHost() {
  useArrowFocusNav(true);
  return (
    <div>
      <div className="sideBarNav">
        <a href="#a">Home</a>
        <a href="#b">Forum</a>
        <a href="#c">Profile</a>
      </div>
      <main id="right_main">
        <button>Content</button>
      </main>
    </div>
  );
}

describe("useArrowFocusNav — sidebar ↔ content", () => {
  it("Up/Down browse the sidebar without leaving it", () => {
    const { getByText } = render(<ShellHost />);
    getByText("Home").focus();
    arrow("ArrowDown");
    expect(active()).toBe("Forum");
    arrow("ArrowUp");
    expect(active()).toBe("Home");
  });

  it("ArrowRight jumps from a nav item straight into the page content", () => {
    const { getByText } = render(<ShellHost />);
    getByText("Forum").focus();
    arrow("ArrowRight");
    expect(active()).toBe("Content");
  });

  it("ArrowLeft keeps focus in the sidebar", () => {
    const { getByText } = render(<ShellHost />);
    getByText("Forum").focus();
    arrow("ArrowLeft");
    expect(active()).toBe("Forum");
  });
});
