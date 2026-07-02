/**
 * Self-validating signed magic link token utilities.
 *
 * Token format: `base64url(JSON.stringify(payload)).<HMAC-SHA256 signature>`
 *
 * The payload contains `{ email, returnTo?, exp }` where `exp` is an epoch-ms
 * timestamp. Tokens expire after 10 minutes. Verification uses timing-safe
 * comparison to prevent side-channel attacks.
 *
 * @packageDocumentation
 */

import crypto from 'node:crypto';

/** Self-validating signed token payload. */
export interface MagicTokenPayload {
  email: string;
  returnTo?: string;
  /** Epoch-ms expiry timestamp. */
  exp: number;
}

/** Token TTL: 10 minutes. */
const TOKEN_TTL_MS = 10 * 60 * 1000;

/** Encode a Buffer or UTF-8 string as base64url. */
function base64urlEncode(data: Buffer | string): string {
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
  return buf.toString('base64url');
}

/** Decode a base64url string to a UTF-8 string. */
function base64urlDecode(encoded: string): string {
  return Buffer.from(encoded, 'base64url').toString('utf8');
}

/** Compute HMAC-SHA256 over `data` using `secret`. Returns base64url. */
function hmacSign(secret: string, data: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest()
    .toString('base64url');
}

/**
 * Generate a signed magic link token.
 *
 * @param payload - Token data (email and optional returnTo).
 * @param secret - Session secret used for HMAC signing.
 * @returns Signed token: `<base64url(payload)>.<signature>`
 */
export function signToken(
  payload: Omit<MagicTokenPayload, 'exp'>,
  secret: string,
): string {
  const fullPayload: MagicTokenPayload = {
    ...payload,
    exp: Date.now() + TOKEN_TTL_MS,
  };
  const encodedPayload = base64urlEncode(JSON.stringify(fullPayload));
  const signature = hmacSign(secret, encodedPayload);
  return `${encodedPayload}.${signature}`;
}

/**
 * Verify and parse a signed magic link token.
 *
 * Returns the parsed payload if the signature is valid and the token has not
 * expired. Returns `null` for any invalid or tampered token.
 * Uses timing-safe comparison to resist side-channel attacks.
 *
 * @param token - Signed token string from the magic link URL.
 * @param secret - Session secret used for HMAC verification.
 * @returns Parsed payload, or `null` if invalid.
 */
export function verifyToken(
  token: string,
  secret: string,
): MagicTokenPayload | null {
  const dotIndex = token.lastIndexOf('.');
  if (dotIndex < 0) return null;

  const encodedPayload = token.slice(0, dotIndex);
  const providedSig = token.slice(dotIndex + 1);

  // Recompute expected signature
  const expectedSig = hmacSign(secret, encodedPayload);

  // Timing-safe comparison (both are base64url of a 32-byte digest)
  try {
    const providedBuf = Buffer.from(providedSig, 'base64url');
    const expectedBuf = Buffer.from(expectedSig, 'base64url');
    if (providedBuf.length !== expectedBuf.length) return null;
    if (!crypto.timingSafeEqual(providedBuf, expectedBuf)) return null;
  } catch {
    return null;
  }

  // Decode and parse payload
  let payload: MagicTokenPayload;
  try {
    payload = JSON.parse(base64urlDecode(encodedPayload)) as MagicTokenPayload;
  } catch {
    return null;
  }

  // Validate required fields and expiry
  if (typeof payload.email !== 'string' || !payload.email) return null;
  if (typeof payload.exp !== 'number' || payload.exp < Date.now()) return null;

  return payload;
}
