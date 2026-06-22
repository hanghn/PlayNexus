/**
 * Coverage for the Supabase-backed paths in keyv.ts.
 *
 * setup.ts loads initRepository.ts → keyv.ts before this file runs, so
 * a plain vi.mock would arrive too late for the already-cached module.
 * Instead we use vi.resetModules() + dynamic import in beforeEach so each
 * test gets a fresh keyv.ts whose createClient reference is the mock.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import type * as KeyvMod from "../src/keyv.ts";

vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn() }));

// Populated via dynamic import in beforeEach after vi.resetModules().
let createRepo!: (typeof KeyvMod)["createRepo"];
let setDbInitializer!: (typeof KeyvMod)["setDbInitializer"];
let createClientMock!: Mock;

type Result = { data?: unknown; error?: { message: string } | null };

/** Build a chainable Supabase query-builder mock. */
function makeChain(result: Result) {
  const orderResult = Object.assign(Promise.resolve(result), {
    limit: vi.fn().mockResolvedValue(result),
  });

  const eqResult = Object.assign(Promise.resolve(result), {
    single: vi.fn().mockResolvedValue(result),
    maybeSingle: vi.fn().mockResolvedValue(result),
    in: vi.fn().mockResolvedValue(result),
    order: vi.fn().mockReturnValue(orderResult),
    eq: vi.fn(), // configured below with self-reference
  });
  eqResult.eq.mockReturnValue(eqResult);

  const q = {
    insert: vi.fn().mockResolvedValue(result),
    upsert: vi.fn().mockResolvedValue(result),
    select: vi.fn(),
    eq: vi.fn().mockReturnValue(eqResult),
    delete: vi.fn(),
  };
  q.select.mockReturnValue(q);
  q.delete.mockReturnValue(q);

  const client = { from: vi.fn().mockReturnValue(q) };
  createClientMock.mockReturnValue(client);

  return { q, eqResult, orderResult };
}

/** Set env vars, activate supabase mode, and return a fresh repo. */
function sbRepo(name: string) {
  process.env.SUPABASE_URL = "https://test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
  setDbInitializer("supabase");
  return createRepo(name);
}

beforeEach(async () => {
  vi.resetModules();
  const sbMod = await import("@supabase/supabase-js");
  createClientMock = vi.mocked(sbMod.createClient) as Mock;
  const keyvMod = await import("../src/keyv.ts");
  createRepo = keyvMod.createRepo;
  setDbInitializer = keyvMod.setDbInitializer;
});

afterEach(() => {
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// setDbInitializer branches
// ---------------------------------------------------------------------------
describe("setDbInitializer", () => {
  it("in-memory mode sets useInMemory=true", () => {
    setDbInitializer("in-memory");
    const repo = createRepo("di-mem");
    expect(repo).toBeDefined();
  });

  it("supabase mode throws when SUPABASE_URL is missing", () => {
    delete process.env.SUPABASE_URL;
    expect(() => setDbInitializer("supabase")).toThrow(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars",
    );
  });

  it("supabase mode throws when SUPABASE_SERVICE_ROLE_KEY is missing", () => {
    process.env.SUPABASE_URL = "https://test.supabase.co";
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(() => setDbInitializer("supabase")).toThrow(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars",
    );
  });

  it("supabase mode calls createClient when credentials are present", () => {
    makeChain({ error: null });
    process.env.SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
    setDbInitializer("supabase");
    expect(createClientMock).toHaveBeenCalledWith(
      "https://test.supabase.co",
      "test-service-key",
      expect.any(Object),
    );
  });
});

// ---------------------------------------------------------------------------
// supabaseRepo — add
// ---------------------------------------------------------------------------
describe("supabaseRepo.add", () => {
  it("returns a key on success", async () => {
    makeChain({ error: null });
    const key = await sbRepo("sb-add-ok").add({ v: 1 });
    expect(typeof key).toBe("string");
  });

  it("throws on insert error", async () => {
    makeChain({ error: { message: "insert error" } });
    await expect(sbRepo("sb-add-err").add({ v: 1 })).rejects.toThrow("insert error");
  });
});

// ---------------------------------------------------------------------------
// supabaseRepo — set
// ---------------------------------------------------------------------------
describe("supabaseRepo.set", () => {
  it("resolves on success", async () => {
    makeChain({ error: null });
    await expect(sbRepo("sb-set-ok").set("k", { v: 2 })).resolves.toBeUndefined();
  });

  it("throws on upsert error", async () => {
    makeChain({ error: { message: "upsert error" } });
    await expect(sbRepo("sb-set-err").set("k", { v: 2 })).rejects.toThrow("upsert error");
  });
});

// ---------------------------------------------------------------------------
// supabaseRepo — get
// ---------------------------------------------------------------------------
describe("supabaseRepo.get", () => {
  it("returns value on success", async () => {
    const { eqResult } = makeChain({ data: null, error: null });
    eqResult.single.mockResolvedValue({ data: { value: { v: 3 } }, error: null });
    await expect(sbRepo("sb-get-ok").get("k")).resolves.toStrictEqual({ v: 3 });
  });

  it("throws when error is returned", async () => {
    const { eqResult } = makeChain({ data: null, error: null });
    eqResult.single.mockResolvedValue({ data: null, error: { message: "not found" } });
    await expect(sbRepo("sb-get-err").get("k")).rejects.toThrow("not found");
  });

  it("throws when data is null (covers the !data branch of error || !data)", async () => {
    const { eqResult } = makeChain({ data: null, error: null });
    eqResult.single.mockResolvedValue({ data: null, error: null });
    await expect(sbRepo("sb-get-nodata").get("k")).rejects.toThrow("not found");
  });
});

// ---------------------------------------------------------------------------
// supabaseRepo — find
// ---------------------------------------------------------------------------
describe("supabaseRepo.find", () => {
  it("returns value when row exists", async () => {
    const { eqResult } = makeChain({ data: null, error: null });
    eqResult.maybeSingle.mockResolvedValue({ data: { value: { v: 4 } } });
    await expect(sbRepo("sb-find-ok").find("k")).resolves.toStrictEqual({ v: 4 });
  });

  it("returns null when no row found", async () => {
    const { eqResult } = makeChain({ data: null, error: null });
    eqResult.maybeSingle.mockResolvedValue({ data: null });
    await expect(sbRepo("sb-find-null").find("k")).resolves.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// supabaseRepo — getMany
// ---------------------------------------------------------------------------
describe("supabaseRepo.getMany", () => {
  it("returns values in key order on success", async () => {
    const { eqResult } = makeChain({ data: null, error: null });
    eqResult.in.mockResolvedValue({
      data: [
        { key: "a", value: { v: 1 } },
        { key: "b", value: { v: 2 } },
      ],
      error: null,
    });
    await expect(sbRepo("sb-getmany-ok").getMany(["a", "b"])).resolves.toStrictEqual([
      { v: 1 },
      { v: 2 },
    ]);
  });

  it("throws on Supabase error", async () => {
    const { eqResult } = makeChain({ data: null, error: null });
    eqResult.in.mockResolvedValue({ data: null, error: { message: "query error" } });
    await expect(sbRepo("sb-getmany-err").getMany(["a"])).rejects.toThrow("query error");
  });

  it("throws when a requested key is absent from results", async () => {
    const { eqResult } = makeChain({ data: null, error: null });
    eqResult.in.mockResolvedValue({ data: [{ key: "a", value: { v: 1 } }], error: null });
    await expect(sbRepo("sb-getmany-missing").getMany(["a", "missing"])).rejects.toThrow("missing");
  });
});

// ---------------------------------------------------------------------------
// supabaseRepo — getAllKeys
// ---------------------------------------------------------------------------
describe("supabaseRepo.getAllKeys", () => {
  it("returns key list on success", async () => {
    makeChain({ data: [{ key: "x" }, { key: "y" }], error: null });
    await expect(sbRepo("sb-keys-ok").getAllKeys()).resolves.toStrictEqual(["x", "y"]);
  });

  it("throws on error", async () => {
    makeChain({ data: null, error: { message: "keys error" } });
    await expect(sbRepo("sb-keys-err").getAllKeys()).rejects.toThrow("keys error");
  });
});

// ---------------------------------------------------------------------------
// supabaseRepo — entries
// ---------------------------------------------------------------------------
describe("supabaseRepo.entries", () => {
  it("returns all entries on success", async () => {
    makeChain({ data: [{ key: "k1", value: { v: 1 } }], error: null });
    await expect(sbRepo("sb-entries-ok").entries()).resolves.toStrictEqual([
      { key: "k1", value: { v: 1 } },
    ]);
  });

  it("throws on error", async () => {
    makeChain({ data: null, error: { message: "entries error" } });
    await expect(sbRepo("sb-entries-err").entries()).rejects.toThrow("entries error");
  });
});

// ---------------------------------------------------------------------------
// supabaseRepo — recentEntries
// ---------------------------------------------------------------------------
describe("supabaseRepo.recentEntries", () => {
  it("returns limited ordered entries on success", async () => {
    const { orderResult } = makeChain({ data: null, error: null });
    orderResult.limit.mockResolvedValue({ data: [{ key: "k1", value: { v: 1 } }], error: null });
    await expect(sbRepo("sb-recent-ok").recentEntries(1)).resolves.toStrictEqual([
      { key: "k1", value: { v: 1 } },
    ]);
  });

  it("throws on error", async () => {
    const { orderResult } = makeChain({ data: null, error: null });
    orderResult.limit.mockResolvedValue({ data: null, error: { message: "recent error" } });
    await expect(sbRepo("sb-recent-err").recentEntries(5)).rejects.toThrow("recent error");
  });
});

// ---------------------------------------------------------------------------
// supabaseRepo — clear
// ---------------------------------------------------------------------------
describe("supabaseRepo.clear", () => {
  it("resolves on success", async () => {
    makeChain({ error: null });
    await expect(sbRepo("sb-clear-ok").clear()).resolves.toBeUndefined();
  });

  it("throws on error", async () => {
    makeChain({ error: { message: "clear error" } });
    await expect(sbRepo("sb-clear-err").clear()).rejects.toThrow("clear error");
  });
});

// ---------------------------------------------------------------------------
// createRepo — lazy-init caching
// ---------------------------------------------------------------------------
describe("createRepo caching", () => {
  it("uses the cached backend on repeated method calls", async () => {
    makeChain({ data: [{ key: "k1" }], error: null });
    const repo = sbRepo("sb-cache");
    await repo.getAllKeys();
    await repo.getAllKeys(); // second call: cached is non-null, skips re-init
  });
});

// ---------------------------------------------------------------------------
// inMemoryRepo — recentEntries (covers the in-memory sorting path)
// ---------------------------------------------------------------------------
describe("inMemoryRepo.recentEntries", () => {
  it("returns the most recent entries up to the limit", async () => {
    const repo = createRepo("kvtest-recent");
    const older = { v: 1, createdAt: "2024-01-01T00:00:00.000Z" };
    const newer = { v: 2, createdAt: "2024-06-01T00:00:00.000Z" };
    await repo.set("a", older);
    await repo.set("b", newer);
    const result = await repo.recentEntries(1);
    expect(result[0].value).toStrictEqual(newer);
  });

  it("sorts entries without createdAt to the end", async () => {
    const repo = createRepo("kvtest-recent-nots");
    // One entry with createdAt, one without — exercises both sides of the ?? "" branch.
    await repo.set("a", { v: 1, createdAt: "2024-06-01T00:00:00.000Z" });
    await repo.set("b", { v: 2 }); // no createdAt → createdAt ?? "" == ""
    const result = await repo.recentEntries(2);
    expect(result).toHaveLength(2);
    expect((result[0].value as { v: number }).v).toBe(1); // the one with createdAt comes first
  });
});

// ---------------------------------------------------------------------------
// inMemoryRepo — store reuse
// ---------------------------------------------------------------------------
describe("inMemoryRepo store reuse", () => {
  it("returns same underlying store when the same repoName is used twice", async () => {
    const r1 = createRepo("shared-store");
    await r1.set("key1", "val1");

    // Second createRepo with the same name reuses the existing in-memory store.
    const r2 = createRepo("shared-store");
    expect(await r2.get("key1")).toBe("val1");
  });
});
