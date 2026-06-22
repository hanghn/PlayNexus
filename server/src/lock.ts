/**
 * Per-key serialization for read-modify-write sequences.
 *
 * Several service operations read a record, mutate it, and write it back
 * (e.g. appending a chat message, applying a game move). When the backing store
 * is in-memory these round-trips are effectively instantaneous, so concurrent
 * callers rarely interleave. Against a remote store (Supabase) the gap between
 * the read and the write is tens of milliseconds, long enough for two callers
 * to both read the same state and have the second write clobber the first — a
 * lost update.
 *
 * `withKeyedLock` runs the tasks for a given key strictly one at a time, in call
 * order, so a record's read-modify-write completes before the next one begins.
 * This is a single-instance guard (it does not coordinate across multiple server
 * processes); for our single-server deployment it makes same-resource updates
 * atomic regardless of backend.
 */

/** The tail of the pending chain for each key (outcome swallowed). */
const tails = new Map<string, Promise<unknown>>();

/**
 * Run `task` once all previously-queued tasks for `key` have settled, ensuring
 * tasks sharing a key never overlap. Returns whatever `task` resolves to and
 * propagates its rejection to the caller; a rejected task does not break the
 * chain for later callers.
 *
 * @param key - Identifies the resource to serialize on (namespace it, e.g.
 *   `game:<id>`, to avoid colliding with unrelated resources).
 * @param task - The async critical section to run exclusively for this key.
 */
export function withKeyedLock<T>(key: string, task: () => Promise<T>): Promise<T> {
  const prior = tails.get(key) ?? Promise.resolve();

  // Chain after the prior task, ignoring its outcome so one failure does not
  // poison the queue for subsequent callers.
  const run = prior.then(task, task);

  // The queue tail tracks settlement (success or failure) without surfacing it.
  const settled = run.then(
    () => undefined,
    () => undefined,
  );
  tails.set(key, settled);

  // Drop the map entry once this task is the last one in the chain, so keys for
  // finished resources do not accumulate.
  void settled.then(() => {
    if (tails.get(key) === settled) tails.delete(key);
  });

  return run;
}
