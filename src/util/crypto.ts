/**
 * Cryptographic utilities for key computation and verification
 */

import crypto from 'node:crypto';

/**
 * Compute path-specific key: HMAC-SHA256(apiKey, normalizedPath)
 */
export function computePathKey(apiKey: string, urlPath: string): string {
  const normalized = urlPath.toLowerCase().replace(/^\/+|\/+$/g, '');
  const hash = crypto
    .createHmac('sha256', apiKey)
    .update(normalized)
    .digest('hex');
  return hash.substring(0, 32);
}

/**
 * Compute insider key: HMAC-SHA256(apiKey, "insider")
 * Works for any path, grants full navigation
 */
export function computeInsiderKey(apiKey: string): string {
  const hash = crypto
    .createHmac('sha256', apiKey)
    .update('insider')
    .digest('hex');
  return hash.substring(0, 32);
}

/**
 * Compute outsider key with expiry: HMAC-SHA256(apiKey, path + "|" + expiry)
 */
export function computeOutsiderKeyWithExpiry(
  apiKey: string,
  urlPath: string,
  expiry: string | number,
): string {
  const normalized = urlPath.toLowerCase().replace(/^\/+|\/+$/g, '');
  const data = `${normalized}|${String(expiry)}`;
  const hash = crypto.createHmac('sha256', apiKey).update(data).digest('hex');
  return hash.substring(0, 32);
}

/**
 * Timing-safe string comparison
 */
export function timingSafeEqual(a: string, b: string): boolean {
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}
