import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OtpChallenge } from "../src/otp.ts";
import { getUserByUsername } from "../src/services/auth.service.ts";

// OTP storage is Supabase-backed in production; for unit tests we mock it with
// an in-memory Map (test-only) so the logic runs without a database.
vi.mock("../src/otp.ts", () => {
  const store = new Map<string, OtpChallenge>();
  return {
    insertChallenge: (record: OtpChallenge) => {
      store.set(record.challengeId, { ...record });
      return Promise.resolve();
    },
    findChallengeById: (challengeId: string) => {
      const record = store.get(challengeId);
      return Promise.resolve(record ? { ...record } : null);
    },
    updateChallenge: (challengeId: string, patch: Partial<OtpChallenge>) => {
      const record = store.get(challengeId);
      if (record) Object.assign(record, patch);
      return Promise.resolve();
    },
    deleteChallengesByUserId: (userId: string) => {
      for (const [id, record] of store) {
        if (record.userId === userId) store.delete(id);
      }
      return Promise.resolve();
    },
    peekStore: store,
  };
});

// Capture the codes "emailed" so tests can read them back.
vi.mock("../src/email.ts", () => {
  const sent: { to: string; code: string; purpose: string }[] = [];
  return {
    sendOtpEmail: (to: string, code: string, purpose: string) => {
      sent.push({ to, code, purpose });
      return Promise.resolve();
    },
    peekSent: sent,
  };
});

const otp = (await import("../src/otp.ts")) as unknown as {
  peekStore: Map<string, OtpChallenge>;
};
const email = (await import("../src/email.ts")) as unknown as {
  peekSent: { to: string; code: string; purpose: string }[];
};
const {
  startLoginChallenge,
  startEnrollChallenge,
  verifyChallenge,
  enableMfa,
  disableMfa,
  getMfaStatus,
} = await import("../src/services/mfa.service.ts");

/** The code from the most recently "sent" email. */
const lastCode = () => email.peekSent[email.peekSent.length - 1].code;

let userId: string;

beforeEach(async () => {
  otp.peekStore.clear();
  email.peekSent.length = 0;
  userId = (await getUserByUsername("user0"))!.userId;
});

describe("startLoginChallenge + verifyChallenge", () => {
  it("emails a 6-digit code and validates it back (COS 2.6)", async () => {
    const challengeId = await startLoginChallenge(userId, "a@b.com", true);
    expect(email.peekSent).toHaveLength(1);
    expect(email.peekSent[0]).toMatchObject({ to: "a@b.com", purpose: "login" });
    expect(lastCode()).toMatch(/^\d{6}$/);

    const result = await verifyChallenge(challengeId, lastCode(), "login");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.challenge.userId).toBe(userId);
      expect(result.challenge.remember).toBe(true); // remember carried through
    }
  });

  it("stores only the hash of the code, never the plaintext", async () => {
    await startLoginChallenge(userId, "a@b.com", false);
    const [record] = [...otp.peekStore.values()];
    expect(record.codeHash).not.toBe(lastCode());
    expect(record.codeHash).toHaveLength(64); // sha256 hex
  });

  it("rejects a wrong code and counts the attempt", async () => {
    const challengeId = await startLoginChallenge(userId, "a@b.com", false);
    const result = await verifyChallenge(challengeId, "000000", "login");
    expect(result).toEqual({ ok: false, reason: "invalid" });
    const [record] = [...otp.peekStore.values()];
    expect(record.attempts).toBe(1);
  });

  it("rejects a code for the wrong purpose", async () => {
    const challengeId = await startLoginChallenge(userId, "a@b.com", false);
    const result = await verifyChallenge(challengeId, lastCode(), "enroll");
    expect(result).toEqual({ ok: false, reason: "invalid" });
  });

  it("is single-use: a consumed code cannot be reused", async () => {
    const challengeId = await startLoginChallenge(userId, "a@b.com", false);
    const code = lastCode();
    expect((await verifyChallenge(challengeId, code, "login")).ok).toBe(true);
    expect(await verifyChallenge(challengeId, code, "login")).toEqual({
      ok: false,
      reason: "invalid",
    });
  });

  it("reports expired once past the 10-minute window (COS 2.6)", async () => {
    const challengeId = await startLoginChallenge(userId, "a@b.com", false);
    const [record] = [...otp.peekStore.values()];
    record.expiresAt = new Date(Date.now() - 1000).toISOString();
    expect(await verifyChallenge(challengeId, lastCode(), "login")).toEqual({
      ok: false,
      reason: "expired",
    });
  });

  it("locks the challenge after too many wrong attempts", async () => {
    const challengeId = await startLoginChallenge(userId, "a@b.com", false);
    for (let i = 0; i < 5; i += 1) {
      expect(await verifyChallenge(challengeId, "000000", "login")).toEqual({
        ok: false,
        reason: "invalid",
      });
    }
    // Even the correct code is now refused.
    expect(await verifyChallenge(challengeId, lastCode(), "login")).toEqual({
      ok: false,
      reason: "locked",
    });
  });
});

describe("enrollment (COS 2.3) and opt-out (COS 2.9)", () => {
  it("enables 2FA after verifying the enrollment code, then disables it", async () => {
    expect(await getMfaStatus(userId)).toEqual({ mfaEnabled: false, email: undefined });

    const challengeId = await startEnrollChallenge(userId, "me@school.edu");
    expect(email.peekSent[0].purpose).toBe("enroll");

    const result = await verifyChallenge(challengeId, lastCode(), "enroll");
    expect(result.ok).toBe(true);
    if (result.ok) await enableMfa(userId, result.challenge.email);

    expect(await getMfaStatus(userId)).toEqual({ mfaEnabled: true, email: "me@school.edu" });

    await disableMfa(userId);
    expect(await getMfaStatus(userId)).toEqual({ mfaEnabled: false, email: undefined });
    expect(otp.peekStore.size).toBe(0); // pending challenges cleared
  });
});
