/**
 * Vitest global setup (runs in the jsdom environment before each test file).
 *
 * Node 22 exposes an experimental `globalThis.localStorage` that is unavailable
 * unless started with `--localstorage-file`. That native global SHADOWS jsdom's
 * `window.localStorage`, so any bare `localStorage` reference — in source
 * (e.g. AccessibilityProvider.tsx) or in tests — resolves to Node's stub and
 * throws. We pin a working Storage (jsdom's if present, else an in-memory
 * polyfill) onto both `globalThis` and `window` so bare references behave the
 * same as in a real browser. Defined as a plain property (not a vi stub) so it
 * survives `vi.unstubAllGlobals()` in test teardown.
 */

function makeStorage(): Storage {
  let store: Record<string, string> = {};
  return {
    get length() {
      return Object.keys(store).length;
    },
    clear() {
      store = {};
    },
    getItem(key: string) {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
    },
    key(index: number) {
      return Object.keys(store)[index] ?? null;
    },
    removeItem(key: string) {
      delete store[key];
    },
    setItem(key: string, value: string) {
      store[key] = String(value);
    },
  };
}

function pinStorage(name: "localStorage" | "sessionStorage"): void {
  const win = (globalThis as { window?: Window }).window;
  const fromJsdom = win?.[name];
  const value = fromJsdom && typeof fromJsdom.clear === "function" ? fromJsdom : makeStorage();
  try {
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  } catch {
    (globalThis as Record<string, unknown>)[name] = value;
  }
  if (win) {
    try {
      Object.defineProperty(win, name, { configurable: true, writable: true, value });
    } catch {
      /* jsdom already owns it — fine */
    }
  }
}

pinStorage("localStorage");
pinStorage("sessionStorage");
