/**
 * Coverage for the authenticated branches of user.controller.ts that are not
 * exercised by user.api.spec.ts or cookie.api.spec.ts.
 */

import { describe, expect, it, vi } from "vitest";
import supertest from "supertest";
import type { OtpChallenge } from "../src/otp.ts";

// Mock OTP and email so MFA flows work without a live database / SMTP server.
// vi.mock is hoisted before imports, so the static app import below picks up
// the mocked versions.
vi.mock("../src/otp.ts", () => {
  const store = new Map<string, OtpChallenge>();
  return {
    insertChallenge: (record: OtpChallenge) => {
      store.set(record.challengeId, { ...record });
      return Promise.resolve();
    },
    findChallengeById: (challengeId: string) =>
      Promise.resolve(store.has(challengeId) ? { ...store.get(challengeId)! } : null),
    updateChallenge: (challengeId: string, patch: Partial<OtpChallenge>) => {
      const r = store.get(challengeId);
      if (r) Object.assign(r, patch);
      return Promise.resolve();
    },
    deleteChallengesByUserId: (userId: string) => {
      for (const [id, r] of store) {
        if (r.userId === userId) store.delete(id);
      }
      return Promise.resolve();
    },
    peekStore: store,
  };
});

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

import { app } from "../src/app.ts";

const otpMock = (await import("../src/otp.ts")) as unknown as {
  peekStore: Map<string, OtpChallenge>;
};
const emailMock = (await import("../src/email.ts")) as unknown as {
  peekSent: { to: string; code: string; purpose: string }[];
};

/** Log in and return the raw "pn_session=<token>" cookie string. */
async function loginUser0(): Promise<string> {
  const res = await supertest(app)
    .post("/api/user/login")
    .send({ username: "user0", password: "pwd0000" });
  const setCookie = res.headers["set-cookie"] as unknown as string[] | undefined;
  const entry = setCookie?.find((c) => c.startsWith("pn_session="));
  if (!entry) throw new Error(`login failed (status ${res.status}): ${JSON.stringify(res.body)}`);
  return entry.split(";")[0];
}

// ---------------------------------------------------------------------------
// GET /api/user/me
// ---------------------------------------------------------------------------
describe("GET /api/user/me", () => {
  it("returns the current user when authenticated", async () => {
    const cookie = await loginUser0();
    const res = await supertest(app).get("/api/user/me").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body.username).toBe("user0");
  });
});

// ---------------------------------------------------------------------------
// POST /api/user/logout
// ---------------------------------------------------------------------------
describe("POST /api/user/logout", () => {
  it("clears the session cookie and returns ok", async () => {
    const cookie = await loginUser0();
    const res = await supertest(app).post("/api/user/logout").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body).toStrictEqual({ ok: true });
    const cleared = (res.headers["set-cookie"] as unknown as string[] | undefined)?.find((c) =>
      c.startsWith("pn_session="),
    );
    expect(cleared).toMatch(/Expires=Thu, 01 Jan 1970/i);
  });

  it("is a no-op when no session cookie is present", async () => {
    const res = await supertest(app).post("/api/user/logout");
    expect(res.status).toBe(200);
    expect(res.body).toStrictEqual({ ok: true });
  });
});

// ---------------------------------------------------------------------------
// GET /api/user/security
// ---------------------------------------------------------------------------
describe("GET /api/user/security", () => {
  it("returns security status when authenticated", async () => {
    const cookie = await loginUser0();
    const res = await supertest(app).get("/api/user/security").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      mfaEnabled: expect.any(Boolean),
      rememberMe: expect.any(Boolean),
    });
  });
});

// ---------------------------------------------------------------------------
// GET /api/user/mfa
// ---------------------------------------------------------------------------
describe("GET /api/user/mfa", () => {
  it("returns MFA status when authenticated", async () => {
    const cookie = await loginUser0();
    const res = await supertest(app).get("/api/user/mfa").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ mfaEnabled: expect.any(Boolean) });
  });
});

// ---------------------------------------------------------------------------
// POST /api/user/mfa/disable
// ---------------------------------------------------------------------------
describe("POST /api/user/mfa/disable", () => {
  it("disables MFA and returns updated status", async () => {
    const cookie = await loginUser0();
    const res = await supertest(app).post("/api/user/mfa/disable").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ mfaEnabled: false });
  });
});

// ---------------------------------------------------------------------------
// POST /api/user/mfa/enroll
// ---------------------------------------------------------------------------
describe("POST /api/user/mfa/enroll", () => {
  it("returns 400 on ill-formed payload", async () => {
    const cookie = await loginUser0();
    const res = await supertest(app)
      .post("/api/user/mfa/enroll")
      .set("Cookie", cookie)
      .send({ notAnEmail: "bad" });
    expect(res.status).toBe(400);
    expect(res.body).toStrictEqual({ error: "Poorly-formed request" });
  });

  it("starts enrollment and returns a challengeId", async () => {
    const cookie = await loginUser0();
    emailMock.peekSent.length = 0;
    const res = await supertest(app)
      .post("/api/user/mfa/enroll")
      .set("Cookie", cookie)
      .send({ email: "user0@example.com" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ challengeId: expect.any(String) });
    expect(emailMock.peekSent).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// POST /api/user/mfa/verify
// ---------------------------------------------------------------------------
describe("POST /api/user/mfa/verify", () => {
  it("returns 400 on ill-formed payload", async () => {
    const cookie = await loginUser0();
    const res = await supertest(app)
      .post("/api/user/mfa/verify")
      .set("Cookie", cookie)
      .send({ bad: "data" });
    expect(res.status).toBe(400);
    expect(res.body).toStrictEqual({ error: "Poorly-formed request" });
  });

  it("returns 401 when OTP code is wrong (otpFailure invalid)", async () => {
    const cookie = await loginUser0();
    emailMock.peekSent.length = 0;
    const enroll = await supertest(app)
      .post("/api/user/mfa/enroll")
      .set("Cookie", cookie)
      .send({ email: "user0@example.com" });
    const { challengeId } = enroll.body as { challengeId: string };

    const res = await supertest(app)
      .post("/api/user/mfa/verify")
      .set("Cookie", cookie)
      .send({ challengeId, code: "000000" });
    expect(res.status).toBe(401);
    expect(res.body).toStrictEqual({ error: "Invalid code" });
  });

  it("returns 410 when OTP code is expired (otpFailure expired)", async () => {
    const cookie = await loginUser0();
    emailMock.peekSent.length = 0;
    const enroll = await supertest(app)
      .post("/api/user/mfa/enroll")
      .set("Cookie", cookie)
      .send({ email: "user0@example.com" });
    const { challengeId } = enroll.body as { challengeId: string };

    const record = otpMock.peekStore.get(challengeId);
    if (record) record.expiresAt = new Date(Date.now() - 1000).toISOString();

    const res = await supertest(app)
      .post("/api/user/mfa/verify")
      .set("Cookie", cookie)
      .send({ challengeId, code: "000000" });
    expect(res.status).toBe(410);
    expect(res.body).toStrictEqual({ error: "Code expired" });
  });

  it("verifies correct OTP and enables MFA", async () => {
    const cookie = await loginUser0();
    emailMock.peekSent.length = 0;
    const enroll = await supertest(app)
      .post("/api/user/mfa/enroll")
      .set("Cookie", cookie)
      .send({ email: "user0@example.com" });
    const { challengeId } = enroll.body as { challengeId: string };

    const code = emailMock.peekSent[0]?.code;
    expect(code).toBeDefined();

    const res = await supertest(app)
      .post("/api/user/mfa/verify")
      .set("Cookie", cookie)
      .send({ challengeId, code });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ mfaEnabled: true });

    // Clean up so later tests start fresh.
    await supertest(app).post("/api/user/mfa/disable").set("Cookie", cookie);
  });
});

// ---------------------------------------------------------------------------
// POST /api/user/security/remember
// ---------------------------------------------------------------------------
describe("POST /api/user/security/remember", () => {
  it("returns 400 on ill-formed payload", async () => {
    const cookie = await loginUser0();
    const res = await supertest(app)
      .post("/api/user/security/remember")
      .set("Cookie", cookie)
      .send({ remember: "notabool" });
    expect(res.status).toBe(400);
    expect(res.body).toStrictEqual({ error: "Poorly-formed request" });
  });

  it("updates remember-me and re-issues the session cookie", async () => {
    const cookie = await loginUser0();
    const res = await supertest(app)
      .post("/api/user/security/remember")
      .set("Cookie", cookie)
      .send({ remember: true });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ rememberMe: true });
    const reissued = (res.headers["set-cookie"] as unknown as string[] | undefined)?.find((c) =>
      c.startsWith("pn_session="),
    );
    expect(reissued).toMatch(/Max-Age=\d+/i);
  });
});

// ---------------------------------------------------------------------------
// POST /api/user/security/revoke-all
// ---------------------------------------------------------------------------
describe("POST /api/user/security/revoke-all", () => {
  it("revokes all sessions and clears cookie", async () => {
    const cookie = await loginUser0();
    const res = await supertest(app).post("/api/user/security/revoke-all").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body).toStrictEqual({ ok: true });
    const cleared = (res.headers["set-cookie"] as unknown as string[] | undefined)?.find((c) =>
      c.startsWith("pn_session="),
    );
    expect(cleared).toMatch(/Expires=Thu, 01 Jan 1970/i);
  });
});

// ---------------------------------------------------------------------------
// POST /api/user/login/verify  — 400 validation branch
// ---------------------------------------------------------------------------
describe("POST /api/user/login/verify", () => {
  it("returns 400 on ill-formed payload", async () => {
    const res = await supertest(app).post("/api/user/login/verify").send({ bad: "data" });
    expect(res.status).toBe(400);
    expect(res.body).toStrictEqual({ error: "Poorly-formed request" });
  });
});

// ---------------------------------------------------------------------------
// MFA login flow — covers postLogin MFA branch, postLoginVerify success/failure,
// and postMfaVerify userId-mismatch (403).
// A fresh user is created, MFA is enabled on them, then the login flow is tested.
// ---------------------------------------------------------------------------
describe("MFA login flow", () => {
  let mfaUsername: string;
  let mfaPassword: string;

  // Create a user and enable MFA before these tests run.
  // We use a fixed prefix so the name is stable within the test run.
  const setup = async () => {
    mfaUsername = `mfaflow-${Math.floor(Math.random() * 1e9)}`;
    mfaPassword = "mfapwd123";

    // 1. Sign up.
    await supertest(app)
      .post("/api/user/signup")
      .send({ username: mfaUsername, password: mfaPassword });

    // 2. Log in to get a session.
    const loginRes = await supertest(app)
      .post("/api/user/login")
      .send({ username: mfaUsername, password: mfaPassword });
    const setCookie = loginRes.headers["set-cookie"] as unknown as string[];
    const cookie = setCookie?.find((c) => c.startsWith("pn_session="))?.split(";")[0];
    if (!cookie) throw new Error("MFA setup: login failed");

    // 3. Enroll MFA.
    emailMock.peekSent.length = 0;
    const enrollRes = await supertest(app)
      .post("/api/user/mfa/enroll")
      .set("Cookie", cookie)
      .send({ email: "mfaflow@example.com" });
    const { challengeId } = enrollRes.body as { challengeId: string };

    // 4. Verify enrollment to activate MFA.
    const code = emailMock.peekSent[0]?.code;
    await supertest(app)
      .post("/api/user/mfa/verify")
      .set("Cookie", cookie)
      .send({ challengeId, code });

    // 5. Log out so the next login hits the MFA challenge path.
    await supertest(app).post("/api/user/logout").set("Cookie", cookie);
  };

  it("postLogin returns mfaRequired when user has MFA enabled", async () => {
    await setup();
    emailMock.peekSent.length = 0;
    const res = await supertest(app)
      .post("/api/user/login")
      .send({ username: mfaUsername, password: mfaPassword });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ mfaRequired: true, challengeId: expect.any(String) });
    expect(emailMock.peekSent).toHaveLength(1);
  });

  it("postLoginVerify returns OTP error on wrong code", async () => {
    await setup();
    emailMock.peekSent.length = 0;
    const loginRes = await supertest(app)
      .post("/api/user/login")
      .send({ username: mfaUsername, password: mfaPassword });
    const { challengeId } = loginRes.body as { challengeId: string };

    const res = await supertest(app)
      .post("/api/user/login/verify")
      .send({ challengeId, code: "000000" });
    expect(res.status).toBe(401);
    expect(res.body).toStrictEqual({ error: "Invalid code" });
  });

  it("postLoginVerify issues session on correct code", async () => {
    await setup();
    emailMock.peekSent.length = 0;
    const loginRes = await supertest(app)
      .post("/api/user/login")
      .send({ username: mfaUsername, password: mfaPassword });
    const { challengeId } = loginRes.body as { challengeId: string };

    const code = emailMock.peekSent[0]?.code;
    expect(code).toBeDefined();

    const res = await supertest(app).post("/api/user/login/verify").send({ challengeId, code });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ username: mfaUsername });
    const setCookie = res.headers["set-cookie"] as unknown as string[] | undefined;
    expect(setCookie?.some((c) => c.startsWith("pn_session="))).toBe(true);
  });

  it("postMfaVerify returns 403 when challenge belongs to a different user", async () => {
    await setup();

    // user0 starts enrollment to get a challengeId + correct code.
    const user0Cookie = await loginUser0();
    emailMock.peekSent.length = 0;
    const enrollRes = await supertest(app)
      .post("/api/user/mfa/enroll")
      .set("Cookie", user0Cookie)
      .send({ email: "user0@example.com" });
    const { challengeId } = enrollRes.body as { challengeId: string };
    const code = emailMock.peekSent[0]?.code;
    expect(code).toBeDefined();

    // Log in as the MFA-enabled user (different userId) to get a session.
    emailMock.peekSent.length = 0;
    const mfaLoginRes = await supertest(app)
      .post("/api/user/login")
      .send({ username: mfaUsername, password: mfaPassword });
    const { challengeId: loginChallengeId } = mfaLoginRes.body as { challengeId: string };
    const loginCode = emailMock.peekSent[0]?.code;
    const verifyRes = await supertest(app)
      .post("/api/user/login/verify")
      .send({ challengeId: loginChallengeId, code: loginCode });
    const mfaCookie = (verifyRes.headers["set-cookie"] as unknown as string[])
      ?.find((c) => c.startsWith("pn_session="))
      ?.split(";")[0];
    if (!mfaCookie) throw new Error("MFA login verify failed");

    // Now try to verify user0's enroll challenge using the mfaUser's session.
    const res = await supertest(app)
      .post("/api/user/mfa/verify")
      .set("Cookie", mfaCookie)
      .send({ challengeId, code });
    expect(res.status).toBe(403);
    expect(res.body).toStrictEqual({ error: "Invalid credentials" });
  });
});

// ---------------------------------------------------------------------------
// Direct controller calls — cover the defensive !req.session guards that are
// unreachable through the router because requireSession middleware always handles
// the 401 first.
// ---------------------------------------------------------------------------
import type { Request, Response } from "express";
import {
  getMe,
  getMfa,
  getSecurity,
  postMfaDisable,
  postMfaEnroll,
  postMfaVerify,
  postRemember,
  postRevokeAllSessions,
} from "../src/controllers/user.controller.ts";

function mockReq(overrides: Partial<Request> = {}): never {
  return { headers: {}, ...overrides } as never;
}

function mockRes(): Response & { statusCode: number; body: unknown } {
  const r = { statusCode: 0, body: undefined as unknown };
  return Object.assign(r, {
    status(code: number) {
      r.statusCode = code;
      return this;
    },
    send(body: unknown) {
      r.body = body;
      return this;
    },
    cookie() {
      return this;
    },
    clearCookie() {
      return this;
    },
  }) as unknown as Response & { statusCode: number; body: unknown };
}

describe("controller guards called directly without a session", () => {
  it("getMe returns 401", async () => {
    const res = mockRes();
    await getMe(mockReq(), res);
    expect(res.statusCode).toBe(401);
  });

  it("getMfa returns 401", async () => {
    const res = mockRes();
    await getMfa(mockReq(), res);
    expect(res.statusCode).toBe(401);
  });

  it("getSecurity returns 401", async () => {
    const res = mockRes();
    await getSecurity(mockReq(), res);
    expect(res.statusCode).toBe(401);
  });

  it("postMfaDisable returns 401", async () => {
    const res = mockRes();
    await postMfaDisable(mockReq(), res);
    expect(res.statusCode).toBe(401);
  });

  it("postMfaEnroll returns 401", async () => {
    const res = mockRes();
    await postMfaEnroll(mockReq(), res);
    expect(res.statusCode).toBe(401);
  });

  it("postMfaVerify returns 401", async () => {
    const res = mockRes();
    await postMfaVerify(mockReq(), res);
    expect(res.statusCode).toBe(401);
  });

  it("postRemember returns 401", async () => {
    const res = mockRes();
    await postRemember(mockReq(), res);
    expect(res.statusCode).toBe(401);
  });

  it("postRevokeAllSessions returns 401", async () => {
    const res = mockRes();
    await postRevokeAllSessions(mockReq(), res);
    expect(res.statusCode).toBe(401);
  });
});
