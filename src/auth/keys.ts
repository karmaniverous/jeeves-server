/**
 * Authentication key verification and management.
 *
 * Key model: each configured key is an API key "seed". Insider and outsider
 * keys are derived from seeds via HMAC. Verification iterates all seeds,
 * checking derived keys. Scopes (if present) further restrict which paths
 * a seed grants access to.
 */

import type {
  KeyVerificationResult,
  ResolvedInsider,
  ResolvedKey,
} from '../config/types.js';
import {
  computeInsiderKey,
  computeOutsiderKeyWithExpiry,
  computePathKey,
  timingSafeEqual,
} from '../util/crypto.js';

/**
 * Check whether a request path matches any of the configured scopes.
 * Supports exact match and trailing wildcard (e.g. "/event", "/path/d/docs/*").
 */
function pathMatchesScopes(requestPath: string, scopes: string[]): boolean {
  const normalized = requestPath.toLowerCase().replace(/\/+$/, '');
  for (const scope of scopes) {
    const s = scope.toLowerCase().replace(/\/+$/, '');
    if (s.endsWith('/*')) {
      const prefix = s.slice(0, -2);
      if (normalized === prefix || normalized.startsWith(prefix + '/')) {
        return true;
      }
    } else if (normalized === s) {
      return true;
    }
  }
  return false;
}

/**
 * Verify a provided key against all configured seeds and determine access mode.
 *
 * Machine API keys can grant both insider and outsider access.
 * Insider (Google OAuth) seeds can only grant outsider access — they are
 * never valid as insider URL keys. This prevents leaked insider seeds from
 * granting browsing access.
 */
export function verifyKey(
  resolvedKeys: ResolvedKey[],
  urlPath: string,
  providedKey: string | undefined,
  expParam: string | undefined,
  resolvedInsiders: ResolvedInsider[] = [],
): KeyVerificationResult {
  const fail: KeyVerificationResult = {
    valid: false,
    mode: null,
    keyName: null,
    seed: null,
  };

  if (!providedKey) return fail;

  for (const rk of resolvedKeys) {
    // Check insider key
    const insiderKey = computeInsiderKey(rk.seed);
    if (timingSafeEqual(providedKey, insiderKey)) {
      if (rk.scopes && !pathMatchesScopes(urlPath, rk.scopes)) {
        continue;
      }
      return { valid: true, mode: 'insider', keyName: rk.name, seed: rk.seed };
    }

    // Check outsider key with expiry
    if (expParam) {
      const expiry = parseInt(expParam, 10);
      if (!isNaN(expiry) && expiry >= Date.now()) {
        const expectedKey = computeOutsiderKeyWithExpiry(
          rk.seed,
          urlPath,
          expParam,
        );
        if (timingSafeEqual(providedKey, expectedKey)) {
          if (rk.scopes && !pathMatchesScopes(urlPath, rk.scopes)) {
            continue;
          }
          return {
            valid: true,
            mode: 'outsider',
            keyName: rk.name,
            seed: rk.seed,
          };
        }
      }
    }

    // Check outsider key without expiry
    const expectedKey = computePathKey(rk.seed, urlPath);
    if (timingSafeEqual(providedKey, expectedKey)) {
      if (rk.scopes && !pathMatchesScopes(urlPath, rk.scopes)) {
        continue;
      }
      return {
        valid: true,
        mode: 'outsider',
        keyName: rk.name,
        seed: rk.seed,
      };
    }
  }

  // Check insider seeds for outsider access ONLY (never insider access)
  for (const ri of resolvedInsiders) {
    if (!ri.seed) continue;

    // Check outsider key with expiry
    if (expParam) {
      const expiry = parseInt(expParam, 10);
      if (!isNaN(expiry) && expiry >= Date.now()) {
        const expectedKey = computeOutsiderKeyWithExpiry(
          ri.seed,
          urlPath,
          expParam,
        );
        if (timingSafeEqual(providedKey, expectedKey)) {
          if (ri.scopes && !pathMatchesScopes(urlPath, ri.scopes)) {
            continue;
          }
          return {
            valid: true,
            mode: 'outsider',
            keyName: ri.email,
            seed: ri.seed,
          };
        }
      }
    }

    // Check outsider key without expiry
    const expectedKey = computePathKey(ri.seed, urlPath);
    if (timingSafeEqual(providedKey, expectedKey)) {
      if (ri.scopes && !pathMatchesScopes(urlPath, ri.scopes)) {
        continue;
      }
      return {
        valid: true,
        mode: 'outsider',
        keyName: ri.email,
        seed: ri.seed,
      };
    }
  }

  return fail;
}

export { pathMatchesScopes as _pathMatchesScopes };
