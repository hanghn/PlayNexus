/**
 * Outbound email, behind a small pluggable interface.
 *
 * Three implementations, chosen at runtime in this order:
 *   - **Brevo HTTP API** — used when `BREVO_API_KEY` is set. Sends over HTTPS, so
 *     it works on hosts that block outbound SMTP ports (e.g. Render).
 *   - **SMTP** (`nodemailer`) — used when `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS` are
 *     set. Good for local use / any SMTP provider (Brevo: smtp-relay.brevo.com:587).
 *   - **console stub** — the fallback when neither is configured. Logs the
 *     message instead of sending it, so the 2FA flow is fully usable in dev and
 *     CI without an email account.
 *
 * Env vars (kept in the gitignored `server/.env`, so CI uses the stub):
 *   BREVO_API_KEY (HTTP API);  SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS (SMTP);
 *   EMAIL_FROM ("Name <email>" or "email") — the verified sender, used by both.
 */

/* eslint no-console: "off" */

import { createTransport, type Transporter } from "nodemailer";

/** A single outbound email. */
export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

/** Something that can deliver an `EmailMessage`. */
export interface EmailSender {
  send: (message: EmailMessage) => Promise<void>;
}

/** Logs the email to the server console instead of sending it. */
const consoleSender: EmailSender = {
  send: ({ to, subject, text }) => {
    console.log(`[email:stub] to=${to} subject=${JSON.stringify(subject)}\n${text}`);
    return Promise.resolve();
  },
};

/** Cached SMTP transport, built lazily on first use. */
let transporter: Transporter | null = null;

/**
 * Build (and cache) the SMTP transport from env vars, or return null if SMTP is
 * not configured. Read lazily so `dotenv` has loaded by the time we look.
 */
function getTransporter(): Transporter | null {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;

  if (!transporter) {
    const port = Number(process.env.SMTP_PORT ?? 587);
    transporter = createTransport({
      host,
      port,
      secure: port === 465, // 465 = implicit TLS; 587 = STARTTLS
      auth: { user, pass },
    });
  }
  return transporter;
}

/** Sends real email over SMTP. */
function smtpSender(transport: Transporter): EmailSender {
  return {
    send: async ({ to, subject, text }) => {
      // `from` must be an address verified with your provider (e.g. a Brevo
      // verified sender). Falls back to the SMTP login if EMAIL_FROM is unset.
      const from = process.env.EMAIL_FROM ?? process.env.SMTP_USER ?? "";
      await transport.sendMail({ from, to, subject, text });
    },
  };
}

/** Sender identity parsed from EMAIL_FROM ("Name <email>" or "email"). */
function parseSender(): { email: string; name?: string } {
  const raw = process.env.EMAIL_FROM ?? process.env.SMTP_USER ?? "";
  const m = raw.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (m) return { email: m[2].trim(), name: m[1].trim() || undefined };
  return { email: raw.trim() };
}

/**
 * Sends real email through Brevo's transactional HTTP API (POST over HTTPS), so
 * it works on hosts that block outbound SMTP ports (e.g. Render).
 */
function brevoApiSender(apiKey: string): EmailSender {
  return {
    send: async ({ to, subject, text }) => {
      const res = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "api-key": apiKey,
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          sender: parseSender(),
          to: [{ email: to }],
          subject,
          textContent: text,
        }),
      });
      if (!res.ok) {
        throw new Error(`Brevo API responded ${res.status}: ${await res.text()}`);
      }
    },
  };
}

/**
 * Returns the active email sender: Brevo HTTP API when `BREVO_API_KEY` is set,
 * else SMTP when configured, else the console stub.
 */
export function getEmailSender(): EmailSender {
  const apiKey = process.env.BREVO_API_KEY;
  if (apiKey) return brevoApiSender(apiKey);
  const transport = getTransporter();
  return transport ? smtpSender(transport) : consoleSender;
}

/**
 * Report at startup whether real email sending is configured, so it's obvious
 * whether 2FA codes will be emailed (SMTP) or just logged (stub). Never throws:
 * a failed SMTP connection logs a warning rather than taking the server down.
 */
export async function verifyEmailSender(): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY;
  if (apiKey) {
    try {
      const res = await fetch("https://api.brevo.com/v3/account", {
        headers: { "api-key": apiKey, accept: "application/json" },
      });
      if (res.ok) {
        console.log("[email] Brevo HTTP API ready — 2FA codes will be emailed (works on Render).");
      } else {
        console.warn(
          `[email] Brevo API key check failed: ${res.status} ${await res.text()}. Check BREVO_API_KEY.`,
        );
      }
    } catch (err) {
      console.warn(`[email] Brevo API check error: ${String(err)}.`);
    }
    return;
  }
  const transport = getTransporter();
  if (!transport) {
    console.log(
      "[email] SMTP not configured — 2FA codes will be logged to the console (stub sender). " +
        "Set SMTP_HOST/SMTP_USER/SMTP_PASS in server/.env to send real email.",
    );
    return;
  }
  try {
    await transport.verify();
    console.log(`[email] SMTP ready (host=${process.env.SMTP_HOST}) — 2FA codes will be emailed.`);
  } catch (err) {
    console.warn(
      `[email] SMTP is configured but the connection check failed: ${String(err)}. ` +
        "Sends will likely fail — check SMTP_* (and that SMTP_PASS is the generated SMTP key) in server/.env.",
    );
  }
}

/**
 * Email a one-time code to a user for either a login challenge or email
 * enrollment confirmation.
 */
export async function sendOtpEmail(
  to: string,
  code: string,
  purpose: "login" | "enroll",
): Promise<void> {
  const subject =
    purpose === "login" ? "Your PlayNexus login code" : "Confirm your PlayNexus email";
  const action =
    purpose === "login"
      ? "complete your login"
      : "confirm this email for two-factor authentication";
  const text =
    `Your PlayNexus code is ${code}.\n\n` +
    `Enter it to ${action}. It expires in 10 minutes.\n` +
    `If you didn't request this, you can ignore this email.`;
  await getEmailSender().send({ to, subject, text });
}
