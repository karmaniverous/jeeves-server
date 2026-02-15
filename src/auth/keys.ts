/**
 * Authentication key verification and management
 */

import type { KeyVerificationResult } from '../config/types.js';
import {
  computeInsiderKey,
  computeOutsiderKeyWithExpiry,
  computePathKey,
  timingSafeEqual,
} from '../util/crypto.js';

/**
 * Verify key and determine access mode
 */
export function verifyKey(
  apiKey: string,
  urlPath: string,
  providedKey: string | undefined,
  expParam: string | undefined,
): KeyVerificationResult {
  if (!providedKey) {
    return { valid: false, mode: null };
  }

  // Check insider key first
  const insiderKey = computeInsiderKey(apiKey);
  if (timingSafeEqual(providedKey, insiderKey)) {
    return { valid: true, mode: 'insider' };
  }

  // Check outsider key with expiry
  if (expParam) {
    const expiry = parseInt(expParam, 10);
    if (isNaN(expiry) || expiry < Date.now()) {
      return { valid: false, mode: null }; // Expired or invalid
    }
    const expectedKey = computeOutsiderKeyWithExpiry(apiKey, urlPath, expParam);
    if (timingSafeEqual(providedKey, expectedKey)) {
      return { valid: true, mode: 'outsider' };
    }
  }

  // Check outsider key without expiry
  const expectedKey = computePathKey(apiKey, urlPath);
  if (timingSafeEqual(providedKey, expectedKey)) {
    return { valid: true, mode: 'outsider' };
  }

  return { valid: false, mode: null };
}
