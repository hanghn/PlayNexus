import { useEffect } from "react";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  'input:not([disabled]):not([type="hidden"])',
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

// Keys we'd rather leave to the focused control (typing, slider adjust, etc.).
const EDITABLE = new Set(["INPUT", "TEXTAREA", "SELECT"]);

/** Focusable elements under `root`, in DOM order, that are actually painted. */
function focusablesIn(root: ParentNode): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (n) => n.getClientRects().length > 0,
  );
}

/** Move focus within a list of elements (wrapping at the ends). */
function move(nodes: HTMLElement[], active: Element | null, key: string, forward: boolean): void {
  if (nodes.length === 0) return;
  const i = active ? nodes.indexOf(active as HTMLElement) : -1;
  let next: number;
  if (key === "Home") next = 0;
  else if (key === "End") next = nodes.length - 1;
  else if (i < 0) next = forward ? 0 : nodes.length - 1;
  else next = forward ? (i + 1) % nodes.length : (i - 1 + nodes.length) % nodes.length;
  nodes[next]?.focus();
}

/**
 * Lets the arrow keys move keyboard focus around the site, so it's navigable
 * without Tab.
 *
 * - In the sidebar, Up/Down browse the nav items and **Right jumps straight into
 *   the page content** (Left stays in the sidebar) — so you can pick a nav item
 *   and step right onto the page without tabbing.
 * - Anywhere else, Down/Right go forward and Up/Left go back through the page's
 *   focusable elements, wrapping at the ends.
 *
 * It bows out when it shouldn't interfere: while typing in a field or adjusting
 * a slider, when a modifier key is held, when another handler already consumed
 * the event, and (via `enabled`) inside a live game where arrows drive play.
 */
export default function useArrowFocusNav(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;

      const forward = e.key === "ArrowDown" || e.key === "ArrowRight";
      const backward = e.key === "ArrowUp" || e.key === "ArrowLeft";
      if (!forward && !backward && e.key !== "Home" && e.key !== "End") return;

      const active = document.activeElement as HTMLElement | null;
      if (active && (EDITABLE.has(active.tagName) || active.isContentEditable)) return;

      // From the sidebar: Up/Down browse the menu, Right enters the content.
      const sidebar = active?.closest<HTMLElement>(".sideBarNav") ?? null;
      if (sidebar) {
        if (e.key === "ArrowRight") {
          const main = document.getElementById("right_main");
          const target = main ? focusablesIn(main)[0] : undefined;
          if (target) {
            e.preventDefault();
            target.focus();
          }
          return;
        }
        if (e.key === "ArrowLeft") {
          e.preventDefault(); // already at the far-left rail; stay put
          return;
        }
        e.preventDefault();
        move(focusablesIn(sidebar), active, e.key, forward);
        return;
      }

      // Otherwise move through the whole page in DOM order.
      const nodes = focusablesIn(document);
      if (nodes.length === 0) return;
      e.preventDefault();
      move(nodes, active, e.key, forward);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
}
