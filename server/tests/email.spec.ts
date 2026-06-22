/**
 * Coverage for email.ts.
 * All other test files mock email.ts, so the real implementation never runs
 * there. This file tests it directly, using vi.resetModules() + dynamic
 * imports in each test so the module-level `transporter` cache starts fresh.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import type * as EmailMod from "../src/email.ts";

vi.mock("nodemailer", () => ({ createTransport: vi.fn() }));

let getEmailSender!: (typeof EmailMod)["getEmailSender"];
let verifyEmailSender!: (typeof EmailMod)["verifyEmailSender"];
let sendOtpEmail!: (typeof EmailMod)["sendOtpEmail"];
let createTransportMock!: Mock;

/** Stub global fetch with a canned response. */
function mockFetch(ok: boolean, status = 200, body = "ok") {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok, status, text: () => Promise.resolve(body) }),
  );
}

beforeEach(async () => {
  vi.resetModules();
  delete process.env.BREVO_API_KEY;
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASS;
  delete process.env.SMTP_PORT;
  delete process.env.EMAIL_FROM;

  const nmMod = await import("nodemailer");
  createTransportMock = vi.mocked(nmMod.createTransport) as Mock;
  const emailMod = await import("../src/email.ts");
  getEmailSender = emailMod.getEmailSender;
  verifyEmailSender = emailMod.verifyEmailSender;
  sendOtpEmail = emailMod.sendOtpEmail;
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// consoleSender
// ---------------------------------------------------------------------------
describe("consoleSender.send", () => {
  it("logs and resolves when no email config is present", async () => {
    const sender = getEmailSender();
    await expect(
      sender.send({ to: "a@b.com", subject: "hi", text: "hello" }),
    ).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getTransporter
// ---------------------------------------------------------------------------
describe("getTransporter", () => {
  function setupSmtp(overrides: { smtpPort?: string } = {}) {
    process.env.SMTP_HOST = "smtp.test.com";
    process.env.SMTP_USER = "user@test.com";
    process.env.SMTP_PASS = "pass";
    if (overrides.smtpPort) process.env.SMTP_PORT = overrides.smtpPort;
    const fakeTransporter = {
      sendMail: vi.fn().mockResolvedValue({}),
      verify: vi.fn().mockResolvedValue(true),
    };
    createTransportMock.mockReturnValue(fakeTransporter);
    return fakeTransporter;
  }

  it("returns null when SMTP vars are missing", () => {
    // No SMTP env vars → consoleSender, not smtpSender
    const sender = getEmailSender();
    expect(sender).toBeDefined();
    expect(createTransportMock).not.toHaveBeenCalled();
  });

  it("creates transporter with port 587 and secure=false by default", () => {
    setupSmtp();
    getEmailSender();
    expect(createTransportMock).toHaveBeenCalledWith(
      expect.objectContaining({ port: 587, secure: false }),
    );
  });

  it("creates transporter with port 465 and secure=true when SMTP_PORT=465", () => {
    setupSmtp({ smtpPort: "465" });
    getEmailSender();
    expect(createTransportMock).toHaveBeenCalledWith(
      expect.objectContaining({ port: 465, secure: true }),
    );
  });

  it("uses explicit SMTP_PORT when set", () => {
    setupSmtp({ smtpPort: "2525" });
    getEmailSender();
    expect(createTransportMock).toHaveBeenCalledWith(expect.objectContaining({ port: 2525 }));
  });

  it("returns cached transporter on repeated calls", () => {
    setupSmtp();
    getEmailSender(); // creates transporter
    getEmailSender(); // uses cached
    expect(createTransportMock).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// smtpSender
// ---------------------------------------------------------------------------
describe("smtpSender.send", () => {
  it("uses EMAIL_FROM when set", async () => {
    process.env.SMTP_HOST = "smtp.test.com";
    process.env.SMTP_USER = "smtp@test.com";
    process.env.SMTP_PASS = "pass";
    process.env.EMAIL_FROM = "override@example.com";
    const fakeTransporter = { sendMail: vi.fn().mockResolvedValue({}) };
    createTransportMock.mockReturnValue(fakeTransporter);
    await getEmailSender().send({ to: "to@test.com", subject: "s", text: "t" });
    expect(fakeTransporter.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ from: "override@example.com" }),
    );
  });

  it("falls back to SMTP_USER when EMAIL_FROM is unset", async () => {
    process.env.SMTP_HOST = "smtp.test.com";
    process.env.SMTP_USER = "smtp@test.com";
    process.env.SMTP_PASS = "pass";
    const fakeTransporter = { sendMail: vi.fn().mockResolvedValue({}) };
    createTransportMock.mockReturnValue(fakeTransporter);
    await getEmailSender().send({ to: "to@test.com", subject: "s", text: "t" });
    expect(fakeTransporter.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ from: "smtp@test.com" }),
    );
  });

  it("throws when sendMail rejects", async () => {
    process.env.SMTP_HOST = "smtp.test.com";
    process.env.SMTP_USER = "smtp@test.com";
    process.env.SMTP_PASS = "pass";
    const fakeTransporter = { sendMail: vi.fn().mockRejectedValue(new Error("SMTP error")) };
    createTransportMock.mockReturnValue(fakeTransporter);
    await expect(
      getEmailSender().send({ to: "to@test.com", subject: "s", text: "t" }),
    ).rejects.toThrow("SMTP error");
  });
});

// ---------------------------------------------------------------------------
// parseSender — tested indirectly via brevoApiSender.send()
// ---------------------------------------------------------------------------
describe("parseSender", () => {
  beforeEach(() => {
    process.env.BREVO_API_KEY = "test-key";
    mockFetch(true);
  });

  it("parses 'Name <email>' format and includes name", async () => {
    process.env.EMAIL_FROM = "Test User <test@example.com>";
    await getEmailSender().send({ to: "b@b.com", subject: "s", text: "t" });
    const body = JSON.parse(
      (vi.mocked(fetch).mock.calls[0] as [unknown, { body: string }])[1].body,
    );
    expect(body.sender).toEqual({ email: "test@example.com", name: "Test User" });
  });

  it("parses '<email>' format and omits name when empty", async () => {
    process.env.EMAIL_FROM = "<noname@example.com>";
    await getEmailSender().send({ to: "b@b.com", subject: "s", text: "t" });
    const body = JSON.parse(
      (vi.mocked(fetch).mock.calls[0] as [unknown, { body: string }])[1].body,
    );
    expect(body.sender).toEqual({ email: "noname@example.com" });
  });

  it("returns plain email when no angle-bracket format", async () => {
    process.env.EMAIL_FROM = "plain@example.com";
    await getEmailSender().send({ to: "b@b.com", subject: "s", text: "t" });
    const body = JSON.parse(
      (vi.mocked(fetch).mock.calls[0] as [unknown, { body: string }])[1].body,
    );
    expect(body.sender).toEqual({ email: "plain@example.com" });
  });

  it("uses SMTP_USER as fallback when EMAIL_FROM is absent", async () => {
    process.env.SMTP_USER = "smtp@example.com";
    await getEmailSender().send({ to: "b@b.com", subject: "s", text: "t" });
    const body = JSON.parse(
      (vi.mocked(fetch).mock.calls[0] as [unknown, { body: string }])[1].body,
    );
    expect(body.sender).toEqual({ email: "smtp@example.com" });
  });

  it("uses empty string sender when neither EMAIL_FROM nor SMTP_USER is set", async () => {
    await getEmailSender().send({ to: "b@b.com", subject: "s", text: "t" });
    const body = JSON.parse(
      (vi.mocked(fetch).mock.calls[0] as [unknown, { body: string }])[1].body,
    );
    expect(body.sender).toEqual({ email: "" });
  });
});

// ---------------------------------------------------------------------------
// brevoApiSender
// ---------------------------------------------------------------------------
describe("brevoApiSender.send", () => {
  it("resolves when fetch returns ok", async () => {
    process.env.BREVO_API_KEY = "good-key";
    mockFetch(true);
    await expect(
      getEmailSender().send({ to: "to@example.com", subject: "sub", text: "msg" }),
    ).resolves.toBeUndefined();
  });

  it("throws with status and body when fetch returns non-ok", async () => {
    process.env.BREVO_API_KEY = "bad-key";
    mockFetch(false, 401, "Unauthorized");
    await expect(
      getEmailSender().send({ to: "to@example.com", subject: "sub", text: "msg" }),
    ).rejects.toThrow("Brevo API responded 401: Unauthorized");
  });
});

// ---------------------------------------------------------------------------
// verifyEmailSender
// ---------------------------------------------------------------------------
describe("verifyEmailSender", () => {
  it("logs success when BREVO_API_KEY check passes", async () => {
    process.env.BREVO_API_KEY = "good-key";
    mockFetch(true);
    await expect(verifyEmailSender()).resolves.toBeUndefined();
  });

  it("warns when BREVO_API_KEY check returns non-ok", async () => {
    process.env.BREVO_API_KEY = "bad-key";
    mockFetch(false, 403, "Forbidden");
    await expect(verifyEmailSender()).resolves.toBeUndefined();
  });

  it("warns when BREVO fetch throws", async () => {
    process.env.BREVO_API_KEY = "err-key";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));
    await expect(verifyEmailSender()).resolves.toBeUndefined();
  });

  it("logs stub message when no email config is present", async () => {
    await expect(verifyEmailSender()).resolves.toBeUndefined();
  });

  it("logs SMTP ready when transport.verify() resolves", async () => {
    process.env.SMTP_HOST = "smtp.test.com";
    process.env.SMTP_USER = "user@test.com";
    process.env.SMTP_PASS = "pass";
    createTransportMock.mockReturnValue({ verify: vi.fn().mockResolvedValue(true) });
    await expect(verifyEmailSender()).resolves.toBeUndefined();
  });

  it("warns when transport.verify() throws", async () => {
    process.env.SMTP_HOST = "smtp.test.com";
    process.env.SMTP_USER = "user@test.com";
    process.env.SMTP_PASS = "pass";
    createTransportMock.mockReturnValue({
      verify: vi.fn().mockRejectedValue(new Error("SMTP connection failed")),
    });
    await expect(verifyEmailSender()).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// sendOtpEmail
// ---------------------------------------------------------------------------
describe("sendOtpEmail", () => {
  it("sends a login-purpose email", async () => {
    // consoleSender logs — no real email sent
    await expect(sendOtpEmail("user@example.com", "123456", "login")).resolves.toBeUndefined();
  });

  it("sends an enroll-purpose email", async () => {
    await expect(sendOtpEmail("user@example.com", "123456", "enroll")).resolves.toBeUndefined();
  });
});
