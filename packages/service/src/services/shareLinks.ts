/**
 * Outsider share links rooted at a path: the key and the relative
 * `/browse` URL that carries it. Shared by the share routes.
 *
 * @packageDocumentation
 */

import {
  computeDeepShareKey,
  computeOutsiderKeyWithExpiry,
  computePathKey,
  type DeepShareParams,
} from '../util/crypto.js';
import { deepShareQuery, pathKeyQuery } from '../util/shareQuery.js';
import { encodeStack } from './deepShareLinks.js';

/** A generated share: the outsider key and its relative browse URL. */
export interface ShareLink {
  key: string;
  url: string;
}

/**
 * Path share for `targetPath`: an expiring key when `exp` is set, a plain
 * path key otherwise (which, on a directory, covers every file below it).
 */
export function createPathShare(
  seed: string,
  targetPath: string,
  exp?: string,
): ShareLink {
  const key = exp
    ? computeOutsiderKeyWithExpiry(seed, targetPath, exp)
    : computePathKey(seed, targetPath);
  return { key, url: `/browse${targetPath}?${pathKeyQuery(key, exp)}` };
}

/** Deep share whose traversal stack starts at `targetPath`. */
export function createDeepShare(
  seed: string,
  targetPath: string,
  options: { depth: number; dirs: boolean; exp?: string },
): ShareLink {
  const params: DeepShareParams = {
    ...options,
    stack: encodeStack([targetPath]),
  };
  const key = computeDeepShareKey(seed, targetPath, params);
  return {
    key,
    url: `/browse${targetPath}?${deepShareQuery(key, params)}`,
  };
}
