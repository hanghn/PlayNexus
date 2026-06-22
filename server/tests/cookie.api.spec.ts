import { describe, expect, it } from "vitest";
import supertest from "supertest";
import { app } from "../src/app.ts";

/** Pull the `pn_session` Set-Cookie string out of a response. */
function sessionCookie(res: { headers: Record<string, unknown> }): string | undefined {
  const setCookie = res.headers["set-cookie"] as string[] | undefined;
  return setCookie?.find((c) => c.startsWith("pn_session="));
}

/**
 * Verifies the COS 2.2 / 2.9 cookie behavior at the HTTP layer: "remember me"
 * controls whether the session cookie is persistent (has a Max-Age) or a
 * browser-session cookie (no Max-Age / Expires), and that toggling it off
 * re-issues the cookie as session-scoped.
 */
describe("session cookie persistence", () => {
  it("login with remember:true sets a persistent cookie", async () => {
    const res = await supertest(app)
      .post("/api/user/login")
      .send({ username: "user0", password: "pwd0000", remember: true });
    expect(res.status).toBe(200);
    const cookie = sessionCookie(res);
    expect(cookie).toBeDefined();
    expect(cookie).toMatch(/Max-Age=\d+/i);
    expect(cookie).toMatch(/HttpOnly/i);
  });

  it("login with remember:false sets a browser-session cookie (no Max-Age)", async () => {
    const res = await supertest(app)
      .post("/api/user/login")
      .send({ username: "user0", password: "pwd0000", remember: false });
    expect(res.status).toBe(200);
    const cookie = sessionCookie(res);
    expect(cookie).toBeDefined();
    expect(cookie).not.toMatch(/Max-Age/i);
    expect(cookie).not.toMatch(/Expires/i);
  });

  it("turning remember off re-issues the cookie as session-scoped (COS 2.9)", async () => {
    // Start with a persistent cookie.
    const login = await supertest(app)
      .post("/api/user/login")
      .send({ username: "user0", password: "pwd0000", remember: true });
    const persistent = sessionCookie(login);
    expect(persistent).toMatch(/Max-Age=\d+/i);
    const cookieHeader = persistent!.split(";")[0]; // pn_session=<token>

    // Turn "remember me" off via the profile security endpoint.
    const off = await supertest(app)
      .post("/api/user/security/remember")
      .set("Cookie", cookieHeader)
      .send({ remember: false });
    expect(off.status).toBe(200);
    expect(off.body).toMatchObject({ rememberMe: false });

    // The freshly issued cookie must be session-scoped (cleared on browser close).
    const reissued = sessionCookie(off);
    expect(reissued).toBeDefined();
    expect(reissued).not.toMatch(/Max-Age/i);
    expect(reissued).not.toMatch(/Expires/i);
  });
});
