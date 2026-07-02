/**
 * Self-validating signed magic link token utilities.
 *
 * Token format: `base64url(JSON.stringify(payload)).<HMAC-SHA256 signature>`
 *
 * The payload contains `{ email, returnTo?, exp }` where `exp` is an epoch-ms
 * timestamp. Tokens expire after 10 minutes. Verification uses timing-safe
 * comparison to prevent side-channel attacks.
 *
 * OTP format: 8 characters from a 32-character lowercase alphanumeric alphabet
 * excluding ambiguous characters (0, 1, o, l). Presented in two groups of four.
 *
 * Encryption: AES-256-GCM with SHA-256(otp) as the key. Output format:
 * `base64url(iv ‖ ciphertext ‖ authTag)` where iv is 12 random bytes.
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

/**
 * 32-character OTP alphabet (lowercase alphanumeric, ambiguous chars excluded).
 * Excludes: 0, 1, o, l.
 */
export const OTP_ALPHABET = '23456789abcdefghijkmnpqrstuvwxyz';

/** AES-GCM IV length: 12 bytes. */
const GCM_IV_BYTES = 12;

/** AES-GCM auth tag length: 16 bytes. */
const GCM_TAG_BYTES = 16;

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

  // Validate required fields, optional field types, and expiry
  if (typeof payload.email !== 'string' || !payload.email) return null;
  if (payload.returnTo !== undefined && typeof payload.returnTo !== 'string')
    return null;
  if (typeof payload.exp !== 'number' || payload.exp < Date.now()) return null;

  return payload;
}

// ---------------------------------------------------------------------------
// OTP generation
// ---------------------------------------------------------------------------

/**
 * Generate a random 8-character OTP from the 32-character alphabet.
 *
 * Each character is drawn uniformly from `OTP_ALPHABET` using modulo reduction.
 * The alphabet length (32) divides 256 evenly, so there is no modulo bias.
 */
export function generateOtp(): string {
  const bytes = crypto.randomBytes(8);
  return Array.from(bytes)
    .map((b) => OTP_ALPHABET[b % 32])
    .join('');
}

/**
 * Format an 8-character OTP as two groups of four separated by a space.
 * e.g. `"a3k7m9p2"` → `"a3k7 m9p2"`
 */
export function formatOtp(otp: string): string {
  return `${otp.slice(0, 4)} ${otp.slice(4)}`;
}

// ---------------------------------------------------------------------------
// AES-256-GCM token encryption / decryption
// ---------------------------------------------------------------------------

/** Derive a 32-byte AES key from an OTP string via SHA-256. */
function otpToKey(otp: string): Buffer {
  return crypto.createHash('sha256').update(otp, 'utf8').digest();
}

/**
 * Encrypt a signed token with AES-256-GCM using the OTP as the key source.
 *
 * Output format: `base64url(iv ‖ ciphertext ‖ authTag)`
 * - IV: 12 random bytes
 * - auth tag: 16 bytes (GCM default)
 *
 * @param token - Signed token string to encrypt.
 * @param otp - 8-character OTP (key derived via SHA-256).
 * @returns Encrypted blob as a base64url string.
 */
export function encryptToken(token: string, otp: string): string {
  const key = otpToKey(otp);
  const iv = crypto.randomBytes(GCM_IV_BYTES);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(token, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, encrypted, authTag]).toString('base64url');
}

/**
 * Decrypt an AES-256-GCM encrypted token blob.
 *
 * Expected blob format: `base64url(iv ‖ ciphertext ‖ authTag)`
 *
 * Returns `null` if decryption fails (wrong OTP, corrupted blob, etc.).
 *
 * @param blob - Encrypted blob as a base64url string.
 * @param otp - 8-character OTP (key derived via SHA-256).
 * @returns Decrypted token string, or `null` on failure.
 */
export function decryptToken(blob: string, otp: string): string | null {
  try {
    const combined = Buffer.from(blob, 'base64url');
    if (combined.length <= GCM_IV_BYTES + GCM_TAG_BYTES) return null;

    const iv = combined.subarray(0, GCM_IV_BYTES);
    const authTag = combined.subarray(combined.length - GCM_TAG_BYTES);
    const ciphertext = combined.subarray(
      GCM_IV_BYTES,
      combined.length - GCM_TAG_BYTES,
    );

    const key = otpToKey(otp);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    return (
      decipher.update(ciphertext).toString('utf8') + decipher.final('utf8')
    );
  } catch {
    return null;
  }
}
