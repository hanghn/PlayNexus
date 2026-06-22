/**
 * Tiny pub/sub so any part of the app can push a message to the global
 * screen-reader live region (rendered once by <LiveAnnouncer/>). This gives
 * in-app events (friend request, new message, score change, turn change) a
 * non-visual indicator to pair with their visual one.
 */
type Listener = (message: string, assertive: boolean) => void;

let current: Listener | null = null;

/** Announce a message to assistive tech. Use assertive for time-critical events. */
export function announce(message: string, assertive = false): void {
  current?.(message, assertive);
}

/** Registered by <LiveAnnouncer/>; not for general use. */
export function setAnnouncer(listener: Listener | null): void {
  current = listener;
}
