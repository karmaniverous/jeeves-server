/**
 * Path-level scope decisions: strict content access, directory navigation
 * (ancestors of allowed paths), and archive entry filtering. Pure
 * functions over NormalizedScopes; no I/O.
 *
 * @packageDocumentation
 */

import picomatch from 'picomatch';

import type { NormalizedScopes } from '../config/types.js';
import {
  _pathMatchesPatterns as pathMatchesPatterns,
  _pathMatchesScopes as pathMatchesScopes,
} from './keys.js';

/** True when `scopes` grant access to the content at `urlPath` (null = unrestricted). */
export function canAccessPath(
  urlPath: string,
  scopes: NormalizedScopes | null | undefined,
): boolean {
  if (!scopes) return true;
  return pathMatchesScopes(urlPath, scopes);
}

/**
 * True when `dirPath` is the root, a path matched by `pattern`'s leading
 * segments, or anything below a `**` segment: i.e. a directory from which
 * a path matching `pattern` may be reached. Matching is per segment and
 * case-insensitive, so wildcard segments (e.g. `jeeves-*`) are honoured.
 */
export function isAncestorOfPattern(dirPath: string, pattern: string): boolean {
  const dirSegments = dirPath.toLowerCase().split('/').filter(Boolean);
  const patternSegments = pattern.toLowerCase().split('/').filter(Boolean);
  for (let i = 0; i < dirSegments.length; i++) {
    const patternSegment = patternSegments[i] as string | undefined;
    if (patternSegment === undefined) return false;
    if (patternSegment === '**') return true;
    if (!picomatch.isMatch(dirSegments[i], patternSegment, { dot: true }))
      return false;
  }
  return true;
}

/**
 * True when `scopes` allow navigating (listing) the directory at `dirPath`:
 * either the directory itself is in scope, or it is an ancestor of an
 * allowed path and is not denied. Listings must still filter their entries.
 */
export function canNavigatePath(
  dirPath: string,
  scopes: NormalizedScopes | null | undefined,
): boolean {
  if (!scopes) return true;
  if (pathMatchesScopes(dirPath, scopes)) return true;
  if (
    scopes.explicitDeny.length > 0 &&
    pathMatchesPatterns(dirPath, scopes.explicitDeny)
  )
    return false;
  if (scopes.explicitAllow.some((p) => isAncestorOfPattern(dirPath, p)))
    return true;
  if (scopes.deny.length > 0 && pathMatchesPatterns(dirPath, scopes.deny))
    return false;
  return scopes.allow.some((p) => isAncestorOfPattern(dirPath, p));
}

/**
 * Predicate over entries below a directory: given an entry's `/`- or
 * `\`-separated path relative to that directory, decides inclusion.
 */
export type EntryFilter = (
  relativePath: string,
  isDirectory: boolean,
) => boolean;

/**
 * Build the {@link EntryFilter} for archiving the directory at `dirUrlPath`
 * under `scopes`: files must be in scope, directories navigable. Directory
 * archive export and its size limit both use it, so they always agree.
 */
export function scopedEntryFilter(
  dirUrlPath: string,
  scopes: NormalizedScopes | null | undefined,
): EntryFilter {
  const base = dirUrlPath.replace(/\/+$/, '');
  return (relativePath, isDirectory) => {
    const entryUrlPath = `${base}/${relativePath.replace(/\\/g, '/')}`;
    return isDirectory
      ? canNavigatePath(entryUrlPath, scopes)
      : canAccessPath(entryUrlPath, scopes);
  };
}
