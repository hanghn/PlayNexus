/**
 * Tests for the Supabase-backed paths in session.ts. The in-memory paths are already covered by
 * session.service.spec.ts which mocks session.ts. Here we set SUPABASE_URL so
 * useSupabase() returns true and mock getSupabaseAdmin to avoid a live DB.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as supabaseAdminModule from "../../src/supabaseAdmin.ts";
import {
  type SessionRecord,
  deleteSessionByTokenHash,
  deleteSessionsByUserId,
  findSessionByTokenHash,
  insertSession,
  touchSession,
} from "../../src/session.ts";

const sample: SessionRecord = {
  sessionId: "sid-test",
  userId: "uid-test",
  tokenHash: "hash-test",
  createdAt: new Date().toISOString(),
  expiresAt: new Date().toISOString(),
  remember: false,
  revoked: false,
  lastSeen: new Date().toISOString(),
};

type QueryResult = { data?: unknown; error?: { message: string } | null };

/**
 * Build a chainable Supabase query-builder mock.
 *
 * `eq()` returns an object that is BOTH awaitable (for `await table().update().eq()`)
 * and has a `maybeSingle()` method (for `table().select().eq().maybeSingle()`).
 * Returns `{ q, eqResult }` so tests can override `eqResult.maybeSingle` individually.
 */
function mockTable(result: QueryResult) {
  const eqResult = Object.assign(Promise.resolve(result), {
    maybeSingle: vi.fn().mockResolvedValue(result),
  });

  const q = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    eq: vi.fn().mockReturnValue(eqResult),
  };
  q.select.mockReturnValue(q);
  q.insert.mockResolvedValue(result);
  q.update.mockReturnValue(q);
  q.delete.mockReturnValue(q);

  vi.spyOn(supabaseAdminModule, "getSupabaseAdmin").mockReturnValue({
    from: vi.fn().mockReturnValue(q),
  } as never);
  return { q, eqResult };
}

// ---------------------------------------------------------------------------
// In-memory touchSession path, only reached when SUPABASE_URL
// is absent. The other in-memory paths are already exercised by
// session.service.spec.ts (via the mock). touchSession is the only function
// whose in-memory branch is not hit by any existing test.
// ---------------------------------------------------------------------------
describe("session.ts — in-memory touchSession", () => {
  const savedUrl = process.env.SUPABASE_URL;
  beforeEach(() => {
    // Force the in-memory backend even when a local server/.env sets SUPABASE_URL.
    delete process.env.SUPABASE_URL;
  });
  afterEach(() => {
    if (savedUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = savedUrl;
  });

  it("updates lastSeen when sessionId matches", async () => {
    // Insert a session in the in-memory store (SUPABASE_URL not set).
    await insertSession(sample);
    const newLastSeen = new Date(Date.now() + 5000).toISOString();
    await touchSession(sample.sessionId, newLastSeen);
    const found = await findSessionByTokenHash(sample.tokenHash);
    expect(found?.lastSeen).toBe(newLastSeen);
    // Clean up.
    await deleteSessionByTokenHash(sample.tokenHash);
  });

  it("is a no-op when sessionId is not found", async () => {
    await insertSession(sample);
    await expect(
      touchSession("nonexistent-sid", new Date().toISOString()),
    ).resolves.toBeUndefined();
    await deleteSessionByTokenHash(sample.tokenHash);
  });

  it("deleteSessionsByUserId removes the user's sessions", async () => {
    await insertSession(sample);
    await deleteSessionsByUserId(sample.userId);
    expect(await findSessionByTokenHash(sample.tokenHash)).toBeNull();
  });

  it("deleteSessionsByUserId leaves other users' sessions", async () => {
    await insertSession(sample);
    await deleteSessionsByUserId("a-different-user");
    expect(await findSessionByTokenHash(sample.tokenHash)).not.toBeNull();
    await deleteSessionByTokenHash(sample.tokenHash);
  });
});

describe("session.ts — Supabase paths", () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = "https://test.supabase.co";
  });

  afterEach(() => {
    delete process.env.SUPABASE_URL;
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // insertSession
  // -------------------------------------------------------------------------
  describe("insertSession", () => {
    it("inserts via Supabase on success", async () => {
      mockTable({ error: null });
      await expect(insertSession(sample)).resolves.toBeUndefined();
    });

    it("throws when Supabase returns an error", async () => {
      mockTable({ error: { message: "insert failed" } });
      await expect(insertSession(sample)).rejects.toThrow(
        "Failed to insert session: insert failed",
      );
    });
  });

  // -------------------------------------------------------------------------
  // findSessionByTokenHash
  // -------------------------------------------------------------------------
  describe("findSessionByTokenHash", () => {
    it("returns the session record on success", async () => {
      const { eqResult } = mockTable({ data: null, error: null });
      eqResult.maybeSingle.mockResolvedValue({ data: sample, error: null });
      const result = await findSessionByTokenHash("hash-test");
      expect(result).toStrictEqual(sample);
    });

    it("returns null when no row is found", async () => {
      const { eqResult } = mockTable({ data: null, error: null });
      eqResult.maybeSingle.mockResolvedValue({ data: null, error: null });
      const result = await findSessionByTokenHash("no-such-hash");
      expect(result).toBeNull();
    });

    it("throws when Supabase returns an error", async () => {
      const { eqResult } = mockTable({ data: null, error: null });
      eqResult.maybeSingle.mockResolvedValue({ data: null, error: { message: "query failed" } });
      await expect(findSessionByTokenHash("hash-test")).rejects.toThrow(
        "Failed to find session: query failed",
      );
    });
  });

  // -------------------------------------------------------------------------
  // touchSession
  // -------------------------------------------------------------------------
  describe("touchSession", () => {
    it("updates lastSeen via Supabase on success", async () => {
      mockTable({ error: null });
      await expect(touchSession("sid-test", new Date().toISOString())).resolves.toBeUndefined();
    });

    it("throws when Supabase returns an error", async () => {
      mockTable({ error: { message: "update failed" } });
      await expect(touchSession("sid-test", new Date().toISOString())).rejects.toThrow(
        "Failed to update session: update failed",
      );
    });
  });

  // -------------------------------------------------------------------------
  // deleteSessionByTokenHash
  // -------------------------------------------------------------------------
  describe("deleteSessionByTokenHash", () => {
    it("deletes via Supabase on success", async () => {
      mockTable({ error: null });
      await expect(deleteSessionByTokenHash("hash-test")).resolves.toBeUndefined();
    });

    it("throws when Supabase returns an error", async () => {
      mockTable({ error: { message: "delete failed" } });
      await expect(deleteSessionByTokenHash("hash-test")).rejects.toThrow(
        "Failed to delete session: delete failed",
      );
    });
  });

  // -------------------------------------------------------------------------
  // deleteSessionsByUserId
  // -------------------------------------------------------------------------
  describe("deleteSessionsByUserId", () => {
    it("deletes all user sessions via Supabase on success", async () => {
      mockTable({ error: null });
      await expect(deleteSessionsByUserId("uid-test")).resolves.toBeUndefined();
    });

    it("throws when Supabase returns an error", async () => {
      mockTable({ error: { message: "bulk delete failed" } });
      await expect(deleteSessionsByUserId("uid-test")).rejects.toThrow(
        "Failed to delete sessions for user: bulk delete failed",
      );
    });
  });
});
