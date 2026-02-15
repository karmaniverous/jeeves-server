/**
 * Authentication key verification and management.
 *
 * Key model: each configured key is an API key "seed". Insider and outsider
 * keys are derived from seeds via HMAC. Verification iterates all seeds,
 * checking derived keys. Scopes (if present) further restrict which paths
 * a seed grants access to.
 *
 * Directory outsider links: an outsider key generated for a directory path
 * grants access to all descendants. Verification checks the provided key
 * against the requested path AND all ancestor paths.
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
 * Get the requested path and all ancestor paths.
 * E.g. "/d/projects/foo/bar.md" results in that path plus all ancestors.
 */
function getPathAndAncestors(urlPath: string): string[] {
  const paths = [urlPath];
  let current = urlPath;
  while (current.includes('/')) {
    current = current.substring(0, current.lastIndexOf('/'));
    paths.push(current);
  }
  return paths;
}

/**
 * Check an outsider key against a seed for exact path or any ancestor (directory links).
 * Returns the matched path if found, or null.
 */
function checkOutsiderKey(
  seed: string,
  urlPath: string,
  providedKey: string,
  expParam: string | undefined,
): string | null {
  const pathsToCheck = getPathAndAncestors(urlPath);

  for (const checkPath of pathsToCheck) {
    // Check with expiry
    if (expParam) {
      const expiry = parseInt(expParam, 10);
      if (!isNaN(expiry) && expiry >= Date.now()) {
        const expectedKey = computeOutsiderKeyWithExpiry(
          seed,
          checkPath,
          expParam,
        );
        if (timingSafeEqual(providedKey, expectedKey)) return checkPath;
      }
    }

    // Check without expiry
    const expectedKey = computePathKey(seed, checkPath);
    if (timingSafeEqual(providedKey, expectedKey)) return checkPath;
  }

  return null;
}

/**
 * Verify a provided key against all configured seeds and determine access mode.
 *
 * Machine API keys can grant both insider and outsider access.
 * Insider (Google OAuth) seeds can only grant outsider access — they are
 * never valid as insider URL keys.
 *
 * Outsider keys are checked against the requested path and all ancestor
 * paths, enabling directory-level outsider links.
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
    matchedPath: null,
  };

  if (!providedKey) return fail;

  // Check machine API keys (insider + outsider access)
  for (const rk of resolvedKeys) {
    // Check insider key (exact only, no ancestor check)
    const insiderKey = computeInsiderKey(rk.seed);
    if (timingSafeEqual(providedKey, insiderKey)) {
      if (rk.scopes && !pathMatchesScopes(urlPath, rk.scopes)) {
        continue;
      }
      return {
        valid: true,
        mode: 'insider',
        keyName: rk.name,
        seed: rk.seed,
        matchedPath: null,
      };
    }

    // Check outsider key (exact path + ancestors for directory links)
    const machineMatch = checkOutsiderKey(
      rk.seed,
      urlPath,
      providedKey,
      expParam,
    );
    if (machineMatch !== null) {
      if (rk.scopes && !pathMatchesScopes(urlPath, rk.scopes)) {
        continue;
      }
      return {
        valid: true,
        mode: 'outsider',
        keyName: rk.name,
        seed: rk.seed,
        matchedPath: machineMatch,
      };
    }
  }

  // Check insider seeds for outsider access ONLY (never insider access)
  for (const ri of resolvedInsiders) {
    if (!ri.seed) continue;

    const insiderMatch = checkOutsiderKey(
      ri.seed,
      urlPath,
      providedKey,
      expParam,
    );
    if (insiderMatch !== null) {
      if (ri.scopes && !pathMatchesScopes(urlPath, ri.scopes)) {
        continue;
      }
      return {
        valid: true,
        mode: 'outsider',
        keyName: ri.email,
        seed: ri.seed,
        matchedPath: insiderMatch,
      };
    }
  }

  return fail;
}

export { pathMatchesScopes as _pathMatchesScopes };
