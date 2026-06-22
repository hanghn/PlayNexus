/**
 * Per-tab persistence of the login token (`pass`).
 *
 * We use `sessionStorage` (not `localStorage`) on purpose: it is scoped to a
 * single tab, so two accounts logged in across two tabs of the same browser
 * each keep their own token. This lets the explicit login token stay
 * authoritative over the shared session cookie, fixing the case where actions
 * (joins, moves, DMs) were misattributed to whichever account owned the cookie.
 */
const KEY = "gamenite.authToken";

interface StoredToken {
  username: string;
  pass: string;
}

export function saveAuthToken(username: string, pass: string): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ username, pass }));
  } catch {
    /* storage unavailable (private mode / SSR) — token simply won't persist */
  }
}

export function loadAuthToken(): StoredToken | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (
      typeof value === "object" &&
      value !== null &&
      typeof (value as StoredToken).username === "string" &&
      typeof (value as StoredToken).pass === "string"
    ) {
      return value as StoredToken;
    }
    return null;
  } catch {
    return null;
  }
}

export function clearAuthToken(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
