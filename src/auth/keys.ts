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

import picomatch from 'picomatch';

import type {
  KeyVerificationResult,
  NormalizedScopes,
  ResolvedInsider,
  ResolvedKey,
} from '../config/types.js';
import {
  computeDeepShareKey,
  computeInsiderKey,
  computeOutsiderKeyWithExpiry,
  computePathKey,
  type DeepShareParams,
  timingSafeEqual,
} from '../util/crypto.js';

/**
 * Check whether a path matches a list of scope patterns.
 * Uses picomatch for glob matching — standard glob semantics apply.
 * Use `/**` for recursive matching, `/*` for single-level only.
 */
function pathMatchesPatterns(requestPath: string, patterns: string[]): boolean {
  const normalized = requestPath.toLowerCase().replace(/\/+$/, '');
  const isMatch = picomatch(
    patterns.map((p) => p.toLowerCase().replace(/\/+$/, '')),
  );
  return isMatch(normalized);
}

/**
 * Check whether a request path matches normalized scopes (allow/deny).
 * Path must match at least one allow rule AND NOT match any deny rule.
 */
function pathMatchesScopes(
  requestPath: string,
  scopes: NormalizedScopes,
): boolean {
  if (!pathMatchesPatterns(requestPath, scopes.allow)) return false;
  if (scopes.deny.length > 0 && pathMatchesPatterns(requestPath, scopes.deny))
    return false;
  return true;
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
  deepParams?: { d: string; dirs: string; s: string },
): string | null {
  // Deep share key check (when d and s params are present)
  if (deepParams) {
    const params: DeepShareParams = {
      depth: parseInt(deepParams.d, 10),
      dirs: deepParams.dirs === '1',
      stack: deepParams.s,
      exp: expParam,
    };
    if (!isNaN(params.depth)) {
      // Check expiry if present
      if (params.exp) {
        const expiry = parseInt(params.exp, 10);
        if (isNaN(expiry) || expiry < Date.now()) return null;
      }
      const expectedKey = computeDeepShareKey(seed, urlPath, params);
      if (timingSafeEqual(providedKey, expectedKey)) return urlPath;
    }
    return null; // Deep params present but invalid — don't fall through to legacy
  }

  // Legacy outsider key check (no deep params)
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
  deepParams?: { d: string; dirs: string; s: string },
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
      deepParams,
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
      deepParams,
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

/**
 * Check whether a directory should be visible given allow scope patterns.
 * A directory is visible if any allowed scope is under it OR above it.
 * This enables navigating toward allowed paths through parent directories.
 */
function directoryVisibleUnderScopes(
  dirUrlPath: string,
  allowPatterns: string[],
): boolean {
  const normalized = dirUrlPath.toLowerCase().replace(/\/+$/, '');
  for (const pattern of allowPatterns) {
    const p = pattern.toLowerCase().replace(/\/+$/, '');
    // Strip trailing glob parts to get the "prefix" of the pattern
    const prefix = p.replace(/\/\*\*$/, '').replace(/\/\*$/, '');
    // Directory is above a scope (navigate toward it)
    if (prefix.startsWith(normalized + '/') || prefix === normalized)
      return true;
    // Directory is under a scope (already inside an allowed area)
    if (normalized.startsWith(prefix + '/') || normalized === prefix)
      return true;
  }
  return false;
}

export {
  directoryVisibleUnderScopes as _directoryVisibleUnderScopes,
  pathMatchesPatterns as _pathMatchesPatterns,
  pathMatchesScopes as _pathMatchesScopes,
};
