import { useEffect } from "react";

/**
 * Registers keyboard shortcuts for the duration of a game component's life.
 * Pass a map of key strings (e.g. "1", "ArrowLeft", "Enter") to callbacks.
 * Callbacks only fire when the event target is NOT an input/textarea/select,
 * so typing in a form field is never intercepted.
 *
 * Usage:
 *   useKeyboardNav({
 *     "1": () => makeMove(1),
 *     "ArrowRight": () => focusNext(),
 *   });
 */
export default function useKeyboardNav(bindings: Record<string, () => void>, enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const handler = bindings[e.key];
      if (handler) {
        e.preventDefault();
        handler();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [bindings, enabled]);
}
