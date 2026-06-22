/**
 * Express middleware for cookie-based sessions.
 *
 * `attachSession` runs on every request: it reads the session cookie, validates
 * it against the `sessions` table, and (if valid) attaches the resolved user to
 * `req.session`. It never blocks a request on its own — routes that require a
 * session opt in with `requireSession`. Invalid, expired, or absent cookies
 * simply leave `req.session` undefined, so their requests are treated as
 * unauthenticated (COS 2.7).
 */

import type { NextFunction, Request, Response } from "express";
import { SESSION_COOKIE, readCookie, validateSession } from "../services/session.service.ts";
import type { UserWithId } from "../types.ts";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** The user resolved from a valid session cookie, if any. */
      session?: UserWithId;
    }
  }
}

/**
 * Validate the session cookie (if present) and attach the user to the request.
 * Always calls `next()`; cookie problems just mean no session is attached.
 */
export async function attachSession(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = readCookie(req.headers.cookie, SESSION_COOKIE);
    const user = await validateSession(token);
    if (user) req.session = user;
  } catch {
    // A storage hiccup must not break unauthenticated routes; treat as no session.
  }
  next();
}

/**
 * Guard for routes that require a valid session cookie. Responds 401 when no
 * session was attached by `attachSession`.
 */
export function requireSession(req: Request, res: Response, next: NextFunction): void {
  if (!req.session) {
    res.status(401).send({ error: "Not authenticated" });
    return;
  }
  next();
}
