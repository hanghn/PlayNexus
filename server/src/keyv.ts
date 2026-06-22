/**
 * Repository abstraction for PlayNexus persistence.
 *
 * Exposes a `Repo<T>` interface backed by either:
 *   - **Supabase Postgres** (production) — when `SUPABASE_URL` is set,
 *     stored in the `playnexus_kv` table scoped by `repoName`.
 *   - **In-memory Map** (tests, local dev) — fallback when env vars
 *     are absent.
 *
 * Backend selection happens in `setDbInitializer`, called once at
 * server startup in `server.ts`. The cached repo wrappers returned by
 * `createRepo` resolve their backend lazily on first method call.
 */

import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import "dotenv/config";

/**
 * Keys in Keyv are strings
 */
export type Key = string;

/**
 * An object allowing access to a repository of key-value data.
 */
export interface Repo<Value> {
  /**
   * Add a value to the repository with a new, random key
   * @param value
   * @returns the new key
   */
  add: (value: Value) => Promise<Key>;

  /**
   * Associates a key with a value. Creates a new key-value mapping if one did
   * not already exist.
   * @param key
   * @param value
   */
  set: (key: Key, value: Value) => Promise<void>;

  /**
   * Search for the value associated with a key that may or may not have an
   * associated value.
   * @param key
   * @returns The value associated with that key, or null if there is no such value
   */
  find: (key: Key) => Promise<Value | null>;

  /**
   * Retrieve the value associated with a key.
   * @param key
   * @returns
   * @throws If the key does not exist
   */
  get: (key: Key) => Promise<Value>;

  /**
   * Retrieve the values associated with a list of keys.
   * @param keys
   * @returns values in the same order as the given keys
   * @throws If any keys are not defined
   */
  getMany: (keys: Key[]) => Promise<Value[]>;

  /**
   * Return all the keys in a key-value repository
   * @returns An array of valid keys
   */
  getAllKeys: () => Promise<Key[]>;

  /**
   * Retrieve every key-value pair in this repository in a single round-trip.
   * @returns an array of { key, value } entries
   */
  entries: () => Promise<{ key: Key; value: Value }[]>;

  /**
   * Like `entries`, but only the `limit` most recent records (ordered by the
   * value's `createdAt`, newest first). Lets large list endpoints fetch a
   * bounded number of rows instead of the entire table.
   */
  recentEntries: (limit: number) => Promise<{ key: Key; value: Value }[]>;

  /**
   * Removes all key-value pairs from storage
   * @returns
   */
  clear: () => Promise<void>;
}

/** Module state: which backend the repos will use */
let supabase: SupabaseClient | null = null;
let useInMemory = true;
const inMemoryStores: Record<string, Map<string, unknown>> = {};

/**
 * Configure which backend the repositories will use.
 * Call this once at server startup.
 *
 * - "supabase" — uses Supabase Postgres via the playnexus_kv table
 * - "in-memory" — uses an in-process Map (default; used by tests)
 */
export function setDbInitializer(mode: "supabase" | "in-memory"): void {
  if (mode === "supabase") {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
    }
    supabase = createClient(url, key, { auth: { persistSession: false } });
    useInMemory = false;
  } else {
    useInMemory = true;
  }
}

/**
 * Factory that returns a `Repo<T>` backed by an in-process `Map`.
 *
 * Used for tests and local development when `SUPABASE_URL` is not set.
 * Each `repoName` gets its own Map in the module-level `inMemoryStores`,
 * persisting for the lifetime of the Node process.
 *
 * @typeParam T - The value type stored in this repository.
 * @param repoName - Unique identifier used to namespace this repo's Map.
 * @returns A `Repo<T>` whose state lives in memory until the process exits.
 */
function inMemoryRepo<T>(repoName: string): Repo<T> {
  if (!inMemoryStores[repoName]) inMemoryStores[repoName] = new Map();
  const store = inMemoryStores[repoName] as Map<string, T>;

  return {
    add: (value) => {
      const key = randomUUID();
      store.set(key, value);
      return Promise.resolve(key);
    },
    set: (key, value) => {
      store.set(key, value);
      return Promise.resolve();
    },
    get: (key) => {
      const v = store.get(key);
      if (v === undefined) {
        return Promise.reject(new Error(`Key ${key} not found in repository ${repoName}`));
      }
      return Promise.resolve(v);
    },
    find: (key) => Promise.resolve(store.get(key) ?? null),
    getMany: (keys) => {
      const result: T[] = [];
      for (const k of keys) {
        const v = store.get(k);
        if (v === undefined) {
          return Promise.reject(new Error(`Key ${k} not found in repository ${repoName}`));
        }
        result.push(v);
      }
      return Promise.resolve(result);
    },
    getAllKeys: () => Promise.resolve(Array.from(store.keys())),
    entries: () =>
      Promise.resolve(Array.from(store.entries()).map(([key, value]) => ({ key, value }))),
    recentEntries: (limit) =>
      Promise.resolve(
        Array.from(store.entries())
          .map(([key, value]) => ({ key, value }))
          .sort((a, b) =>
            String((b.value as { createdAt?: string }).createdAt ?? "").localeCompare(
              String((a.value as { createdAt?: string }).createdAt ?? ""),
            ),
          )
          .slice(0, limit),
      ),
    clear: () => {
      store.clear();
      return Promise.resolve();
    },
  };
}

/**
 * Factory that returns a `Repo<T>` backed by Supabase Postgres.
 *
 * Reads and writes go to the `playnexus_kv` table, scoped by `repoName`
 * so different repos coexist in the single table.
 *
 * @typeParam T - The value type stored in this repository.
 * @param repoName - Identifier used as the `repoName` column value.
 * @returns A `Repo<T>` whose state persists in Supabase.
 * @throws If the Supabase client has not been initialized by `setDbInitializer`.
 */
function supabaseRepo<T>(repoName: string): Repo<T> {
  if (!supabase) throw new Error("Supabase client not initialized");
  const sb = supabase;

  return {
    add: async (value) => {
      const key = randomUUID();
      const { error } = await sb
        .from("playnexus_kv")
        .insert({ ["repoName"]: repoName, key, value });
      if (error) {
        throw new Error(`Failed to add to ${repoName}: ${error.message}`);
      }
      return key;
    },

    set: async (key, value) => {
      const { error } = await sb
        .from("playnexus_kv")
        .upsert({ ["repoName"]: repoName, key, value });
      if (error) {
        throw new Error(`Failed to set ${key} in ${repoName}: ${error.message}`);
      }
    },

    get: async (key) => {
      const { data, error } = await sb
        .from("playnexus_kv")
        .select("value")
        .eq("repoName", repoName)
        .eq("key", key)
        .single();
      if (error || !data) {
        throw new Error(`Key ${key} not found in repository ${repoName}`);
      }
      return data.value as T;
    },

    find: async (key) => {
      const { data } = await sb
        .from("playnexus_kv")
        .select("value")
        .eq("repoName", repoName)
        .eq("key", key)
        .maybeSingle();
      return (data?.value as T) ?? null;
    },

    getMany: async (keys) => {
      const { data, error } = await sb
        .from("playnexus_kv")
        .select("key, value")
        .eq("repoName", repoName)
        .in("key", keys);
      if (error) {
        throw new Error(`getMany failed in ${repoName}: ${error.message}`);
      }
      const map = new Map(data.map((row: { key: string; value: unknown }) => [row.key, row.value]));
      return keys.map((k) => {
        if (!map.has(k)) {
          throw new Error(`Key ${k} not found in repository ${repoName}`);
        }
        return map.get(k) as T;
      });
    },

    getAllKeys: async () => {
      const { data, error } = await sb.from("playnexus_kv").select("key").eq("repoName", repoName);
      if (error) {
        throw new Error(`getAllKeys failed in ${repoName}: ${error.message}`);
      }
      return data.map((row: { key: string }) => row.key);
    },

    entries: async () => {
      const { data, error } = await sb
        .from("playnexus_kv")
        .select("key, value")
        .eq("repoName", repoName);
      if (error) {
        throw new Error(`entries failed in ${repoName}: ${error.message}`);
      }
      return data.map((row: { key: string; value: T }) => ({ key: row.key, value: row.value }));
    },

    recentEntries: async (limit) => {
      const { data, error } = await sb
        .from("playnexus_kv")
        .select("key, value")
        .eq("repoName", repoName)
        .order("value->>createdAt", { ascending: false })
        .limit(limit);
      if (error) {
        throw new Error(`recentEntries failed in ${repoName}: ${error.message}`);
      }
      return data.map((row: { key: string; value: T }) => ({ key: row.key, value: row.value }));
    },

    clear: async () => {
      const { error } = await sb.from("playnexus_kv").delete().eq("repoName", repoName);
      if (error) {
        throw new Error(`clear failed in ${repoName}: ${error.message}`);
      }
    },
  };
}

/**
 * Creates a new repository that stores key-value pairs.
 * Picks the backend (Supabase or in-memory) based on what
 * `setDbInitializer` was called with.
 *
 * @param repoName - A distinct identifier for this repository.
 * @returns A new `Repo` object.
 */
export function createRepo<T = unknown>(repoName: string): Repo<T> {
  // Lazy initialization: pick backend at first method call, not at import time
  let cached: Repo<T> | null = null;
  const init = (): Repo<T> => {
    if (!cached) {
      cached = useInMemory ? inMemoryRepo<T>(repoName) : supabaseRepo<T>(repoName);
    }
    return cached;
  };

  return {
    add: (value) => init().add(value),
    set: (key, value) => init().set(key, value),
    get: (key) => init().get(key),
    find: (key) => init().find(key),
    getMany: (keys) => init().getMany(keys),
    getAllKeys: () => init().getAllKeys(),
    entries: () => init().entries(),
    recentEntries: (limit) => init().recentEntries(limit),
    clear: () => init().clear(),
  };
}
