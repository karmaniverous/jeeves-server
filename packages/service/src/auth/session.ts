/**
 * Cookie-based session management for Google OAuth insiders.
 *
 * Session cookie = base64(payload) + "." + HMAC(sessionSecret, base64part)
 * No server-side session store needed — config has all insider state.
 */

import crypto from 'node:crypto';

import type { FastifyReply, FastifyRequest } from 'fastify';

const COOKIE_NAME = 'jeeves_session';
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

interface SessionPayload {
  email: string;
  picture?: string;
  exp: number;
}

/**
 * Create a signed session cookie value.
 */
export function createSessionCookie(
  email: string,
  sessionSecret: string,
  picture?: string,
): string {
  const payload: SessionPayload = {
    email,
    ...(picture ? { picture } : {}),
    exp: Date.now() + SESSION_MAX_AGE_MS,
  };
  const b64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', sessionSecret)
    .update(b64)
    .digest('hex');
  return `${b64}.${sig}`;
}

/**
 * Verify and decode a session cookie. Returns null if invalid/expired.
 */
export function verifySessionCookie(
  cookieValue: string,
  sessionSecret: string,
): SessionPayload | null {
  const dotIdx = cookieValue.lastIndexOf('.');
  if (dotIdx < 0) return null;

  const b64 = cookieValue.slice(0, dotIdx);
  const sig = cookieValue.slice(dotIdx + 1);

  const expectedSig = crypto
    .createHmac('sha256', sessionSecret)
    .update(b64)
    .digest('hex');

  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
      return null;
    }
  } catch {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(b64, 'base64url').toString(),
    ) as SessionPayload;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Set the standard insider session cookie on a reply.
 */
export function setSessionCookie(
  reply: FastifyReply,
  request: FastifyRequest,
  email: string,
  sessionSecret: string,
  picture?: string,
): void {
  const cookieValue = createSessionCookie(email, sessionSecret, picture);
  void reply.setCookie(COOKIE_NAME, cookieValue, {
    path: '/',
    httpOnly: true,
    secure:
      (request.headers['x-forwarded-proto'] as string | undefined) ===
      'https',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60,
  });
}

export { COOKIE_NAME };
