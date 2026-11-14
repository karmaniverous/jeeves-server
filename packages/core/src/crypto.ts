/**
 * Cryptographic utilities for HMAC key computation and verification.
 *
 * The link-key functions (`computeInsiderKey`, `computeOutsiderKeyWithExpiry`,
 * `computePathKey`) are re-exported from `@karmaniverous/jeeves`, which holds
 * the one implementation (#307). The deep-share key and the timing-safe
 * comparison stay here: jeeves has no equivalent.
 *
 * @packageDocumentation
 */

import crypto from 'node:crypto';

export {
  computeInsiderKey,
  computeOutsiderKeyWithExpiry,
  computePathKey,
} from '@karmaniverous/jeeves';

/**
 * Deep share key parameters
 */
export interface DeepShareParams {
  depth: number;
  dirs: boolean;
  stack: string; // lz-string compressToEncodedURIComponent'd path stack
  exp?: string;
}

/**
 * Compute deep share key: HMAC-SHA256(seed, path + "|" + d + "|" + dirs + "|" + stack + "|" + exp)
 * Used for share links with depth \> 0 or dirs enabled.
 */
export function computeDeepShareKey(
  seed: string,
  urlPath: string,
  params: DeepShareParams,
): string {
  const normalized = urlPath.toLowerCase().replace(/^\/+|\/+$/g, '');
  const data = `${normalized}|${String(params.depth)}|${params.dirs ? '1' : '0'}|${params.stack}|${params.exp ?? ''}`;
  const hash = crypto.createHmac('sha256', seed).update(data).digest('hex');
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
