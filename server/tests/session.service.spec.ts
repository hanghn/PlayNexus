import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionRecord } from "../src/session.ts";
import { getUserByUsername } from "../src/services/auth.service.ts";

// The session store is Supabase-only in product code. For unit tests we mock the
// storage layer with an in-memory Map (test-only) so we can exercise the
// minting/validation/revocation logic without a live database.
vi.mock("../src/session.ts", () => {
  const store = new Map<string, SessionRecord>();
  return {
    insertSession: (record: SessionRecord) => {
      store.set(record.tokenHash, record);
      return Promise.resolve();
    },
    findSessionByTokenHash: (tokenHash: string) => Promise.resolve(store.get(tokenHash) ?? null),
    touchSession: (sessionId: string, lastSeen: string) => {
      for (const record of store.values()) {
        if (record.sessionId === sessionId) record.lastSeen = lastSeen;
      }
      return Promise.resolve();
    },
    deleteSessionByTokenHash: (tokenHash: string) => {
      store.delete(tokenHash);
      return Promise.resolve();
    },
    deleteSessionsByUserId: (userId: string) => {
      for (const [hash, record] of store) {
        if (record.userId === userId) store.delete(hash);
      }
      return Promise.resolve();
    },
    peekStore: store,
  };
});

// Pull in the mocked store so tests can inspect/tamper with persisted rows.
const mockedStore = (await import("../src/session.ts")) as unknown as {
  peekStore: Map<string, SessionRecord>;
};
const {
  createSession,
  validateSession,
  revokeSession,
  revokeAllSessionsForUser,
  readCookie,
  sessionUserFromCookies,
  SESSION_COOKIE,
} = await import("../src/services/session.service.ts");

let userId: string;

beforeEach(async () => {
  mockedStore.peekStore.clear();
  // resetEverythingToDefaults (global setup) recreates user0.
  userId = (await getUserByUsername("user0"))!.userId;
});

describe("createSession + validateSession", () => {
  it("mints a session whose token validates back to the user", async () => {
    const { token } = await createSession(userId, false);
    const user = await validateSession(token);
    expect(user).toEqual({ userId, username: "user0" });
  });

  it("does not store the raw token (only its hash)", async () => {
    const { token } = await createSession(userId, false);
    const [record] = [...mockedStore.peekStore.values()];
    expect(record.tokenHash).not.toBe(token);
    expect(record.tokenHash).toHaveLength(64); // sha256 hex
  });

  it("uses a 30-day expiry for remembered sessions and 1-day otherwise", async () => {
    const { expiresAt: shortLived } = await createSession(userId, false);
    const { expiresAt: remembered } = await createSession(userId, true);
    const shortDays = (shortLived.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    const longDays = (remembered.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    expect(shortDays).toBeCloseTo(1, 1);
    expect(longDays).toBeCloseTo(30, 1);
  });

  it("returns null for an unknown token (COS 2.7)", async () => {
    await createSession(userId, false);
    expect(await validateSession("not-a-real-token")).toBeNull();
  });

  it("returns null and deletes the row for an expired session (COS 2.7)", async () => {
    const { token } = await createSession(userId, false);
    const [record] = [...mockedStore.peekStore.values()];
    record.expiresAt = new Date(Date.now() - 1000).toISOString();

    expect(await validateSession(token)).toBeNull();
    expect(mockedStore.peekStore.size).toBe(0);
  });

  it("returns null for a revoked session", async () => {
    const { token } = await createSession(userId, false);
    const [record] = [...mockedStore.peekStore.values()];
    record.revoked = true;

    expect(await validateSession(token)).toBeNull();
  });
});

describe("revokeSession", () => {
  it("invalidates a single session (logout)", async () => {
    const { token } = await createSession(userId, false);
    await revokeSession(token);
    expect(await validateSession(token)).toBeNull();
  });

  it("is a no-op for a missing token", async () => {
    await expect(revokeSession(undefined)).resolves.toBeUndefined();
  });
});

describe("revokeAllSessionsForUser (opt-out, COS 2.9)", () => {
  it("removes every session belonging to the user", async () => {
    const a = await createSession(userId, false);
    const b = await createSession(userId, true);
    await revokeAllSessionsForUser(userId);
    expect(await validateSession(a.token)).toBeNull();
    expect(await validateSession(b.token)).toBeNull();
    expect(mockedStore.peekStore.size).toBe(0);
  });
});

describe("validateSession edge cases", () => {
  it("returns null for an absent token", async () => {
    expect(await validateSession(undefined)).toBeNull();
  });

  it("returns null and cleans up when the session's user no longer exists", async () => {
    const { token } = await createSession("ghost-user-id", false);
    expect(await validateSession(token)).toBeNull();
    expect(mockedStore.peekStore.size).toBe(0);
  });

  it("refreshes lastSeen once it has gone stale", async () => {
    const { token } = await createSession(userId, false);
    const [record] = [...mockedStore.peekStore.values()];
    record.lastSeen = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    await validateSession(token);
    expect(new Date(record.lastSeen).getTime()).toBeGreaterThan(Date.now() - 60_000);
  });
});

describe("readCookie", () => {
  it("returns undefined without a header", () => {
    expect(readCookie(undefined, SESSION_COOKIE)).toBeUndefined();
  });

  it("extracts and decodes a named cookie, skipping malformed parts", () => {
    expect(readCookie(`junk; ${SESSION_COOKIE}=ab%20cd; x=1`, SESSION_COOKIE)).toBe("ab cd");
  });

  it("returns undefined when the cookie isn't present", () => {
    expect(readCookie("a=1; b=2", SESSION_COOKIE)).toBeUndefined();
  });
});

describe("sessionUserFromCookies", () => {
  it("returns null without a valid session cookie", async () => {
    expect(await sessionUserFromCookies(undefined)).toBeNull();
    expect(await sessionUserFromCookies("other=1")).toBeNull();
  });

  it("resolves the user from a valid session cookie", async () => {
    const { token } = await createSession(userId, false);
    expect((await sessionUserFromCookies(`${SESSION_COOKIE}=${token}`))?.userId).toBe(userId);
  });
});

// Helpers to build minimal Express-like req/res/next mocks
function makeReq(cookie?: string) {
  return { headers: { cookie } } as import("express").Request;
}
function makeRes() {
  const res = { statusCode: 0, body: undefined as unknown };
  return Object.assign(res, {
    status(code: number) {
      res.statusCode = code;
      return this;
    },
    send(body: unknown) {
      res.body = body;
      return this;
    },
  }) as unknown as import("express").Response;
}

const { attachSession, requireSession } = await import("../src/middleware/session.middleware.ts");

describe("attachSession middleware", () => {
  it("attaches the user when the session cookie is valid", async () => {
    const { token } = await createSession(userId, false);
    const req = makeReq(`${SESSION_COOKIE}=${token}`);
    const next = vi.fn();
    await attachSession(req, makeRes(), next);
    expect(req.session?.userId).toBe(userId);
    expect(next).toHaveBeenCalled();
  });

  it("calls next without attaching session for an invalid cookie", async () => {
    const req = makeReq(`${SESSION_COOKIE}=bad-token`);
    const next = vi.fn();
    await attachSession(req, makeRes(), next);
    expect(req.session).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  it("calls next without attaching session when no cookie header is present", async () => {
    const req = makeReq(undefined);
    const next = vi.fn();
    await attachSession(req, makeRes(), next);
    expect(req.session).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });
});

describe("requireSession middleware", () => {
  it("calls next when a session is attached", () => {
    const req = makeReq();
    req.session = { userId, username: "user0" };
    const res = makeRes();
    const next = vi.fn();
    requireSession(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBe(0);
  });

  it("responds 401 when no session is attached", () => {
    const req = makeReq();
    const res = makeRes();
    const next = vi.fn();
    requireSession(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });
});
