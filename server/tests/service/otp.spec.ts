/**
 * Tests for the real otp.ts module.
 * All other test files mock otp.ts entirely, so its code never runs there.
 * Here we test it directly, covering both the in-memory fallback paths
 * (SUPABASE_URL absent) and the Supabase-backed paths (SUPABASE_URL set).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as supabaseAdminModule from "../../src/supabaseAdmin.ts";
import {
  type OtpChallenge,
  deleteChallengesByUserId,
  findChallengeById,
  insertChallenge,
  updateChallenge,
} from "../../src/otp.ts";

const sample: OtpChallenge = {
  challengeId: "cid-test",
  userId: "uid-test",
  email: "test@example.com",
  codeHash: "hash-abc",
  purpose: "enroll",
  remember: false,
  attempts: 0,
  consumed: false,
  createdAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
};

type QueryResult = { data?: unknown; error?: { message: string } | null };

/** Chainable Supabase query-builder mock (same dual-await pattern as session.ts.spec.ts). */
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
// In-memory paths (SUPABASE_URL not set)
// ---------------------------------------------------------------------------
describe("otp.ts — in-memory paths", () => {
  const savedUrl = process.env.SUPABASE_URL;
  beforeEach(() => {
    // Force the in-memory backend even when a local server/.env sets SUPABASE_URL.
    delete process.env.SUPABASE_URL;
  });
  afterEach(async () => {
    await deleteChallengesByUserId(sample.userId);
    if (savedUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = savedUrl;
  });

  it("insertChallenge stores and findChallengeById retrieves it", async () => {
    await insertChallenge(sample);
    const found = await findChallengeById(sample.challengeId);
    expect(found).toStrictEqual(sample);
  });

  it("findChallengeById returns null for unknown id", async () => {
    expect(await findChallengeById("no-such-id")).toBeNull();
  });

  it("updateChallenge mutates an existing record", async () => {
    await insertChallenge(sample);
    await updateChallenge(sample.challengeId, { attempts: 3 });
    const found = await findChallengeById(sample.challengeId);
    expect(found?.attempts).toBe(3);
  });

  it("updateChallenge is a no-op for an unknown id", async () => {
    await expect(updateChallenge("no-such-id", { attempts: 1 })).resolves.toBeUndefined();
  });

  it("deleteChallengesByUserId removes matching records", async () => {
    await insertChallenge(sample);
    await deleteChallengesByUserId(sample.userId);
    expect(await findChallengeById(sample.challengeId)).toBeNull();
  });

  it("deleteChallengesByUserId skips non-matching records", async () => {
    await insertChallenge(sample);
    await deleteChallengesByUserId("different-user");
    expect(await findChallengeById(sample.challengeId)).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Supabase paths (SUPABASE_URL set, getSupabaseAdmin mocked)
// ---------------------------------------------------------------------------
describe("otp.ts — Supabase paths", () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = "https://test.supabase.co";
  });

  afterEach(() => {
    delete process.env.SUPABASE_URL;
    vi.restoreAllMocks();
  });

  describe("insertChallenge", () => {
    it("inserts via Supabase on success", async () => {
      mockTable({ error: null });
      await expect(insertChallenge(sample)).resolves.toBeUndefined();
    });

    it("throws when Supabase returns an error", async () => {
      mockTable({ error: { message: "insert failed" } });
      await expect(insertChallenge(sample)).rejects.toThrow(
        "Failed to insert OTP challenge: insert failed",
      );
    });
  });

  describe("findChallengeById", () => {
    it("returns the challenge on success", async () => {
      const { eqResult } = mockTable({ data: null, error: null });
      eqResult.maybeSingle.mockResolvedValue({ data: sample, error: null });
      expect(await findChallengeById(sample.challengeId)).toStrictEqual(sample);
    });

    it("returns null when no row found", async () => {
      const { eqResult } = mockTable({ data: null, error: null });
      eqResult.maybeSingle.mockResolvedValue({ data: null, error: null });
      expect(await findChallengeById("no-such-id")).toBeNull();
    });

    it("throws when Supabase returns an error", async () => {
      const { eqResult } = mockTable({ data: null, error: null });
      eqResult.maybeSingle.mockResolvedValue({ data: null, error: { message: "query failed" } });
      await expect(findChallengeById(sample.challengeId)).rejects.toThrow(
        "Failed to find OTP challenge: query failed",
      );
    });
  });

  describe("updateChallenge", () => {
    it("updates via Supabase on success", async () => {
      mockTable({ error: null });
      await expect(updateChallenge(sample.challengeId, { attempts: 1 })).resolves.toBeUndefined();
    });

    it("throws when Supabase returns an error", async () => {
      mockTable({ error: { message: "update failed" } });
      await expect(updateChallenge(sample.challengeId, { attempts: 1 })).rejects.toThrow(
        "Failed to update OTP challenge: update failed",
      );
    });
  });

  describe("deleteChallengesByUserId", () => {
    it("deletes via Supabase on success", async () => {
      mockTable({ error: null });
      await expect(deleteChallengesByUserId(sample.userId)).resolves.toBeUndefined();
    });

    it("throws when Supabase returns an error", async () => {
      mockTable({ error: { message: "delete failed" } });
      await expect(deleteChallengesByUserId(sample.userId)).rejects.toThrow(
        "Failed to delete OTP challenges for user: delete failed",
      );
    });
  });
});
