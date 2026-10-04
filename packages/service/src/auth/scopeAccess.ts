/**
 * Path-level scope enforcement for insiders: strict content access checks,
 * directory navigation checks (ancestors of allowed paths), and API URL to
 * content path mapping. Pure functions; no I/O.
 *
 * @packageDocumentation
 */

import picomatch from 'picomatch';

import type { NormalizedScopes } from '../config/types.js';
import {
  _pathMatchesPatterns as pathMatchesPatterns,
  _pathMatchesScopes as pathMatchesScopes,
} from './keys.js';

/**
 * API route prefixes whose remaining URL path addresses filesystem content.
 * The content path is the URL path with the prefix removed.
 */
const CONTENT_ROUTE_PREFIXES = [
  '/api/path',
  '/api/file',
  '/api/raw',
  '/api/export-cache',
  '/api/export',
  '/api/mermaid-export',
  '/api/plantuml-export',
  '/api/link-info',
] as const;

/** A content-addressing API route prefix. */
export type ContentRoutePrefix = (typeof CONTENT_ROUTE_PREFIXES)[number];

/**
 * Prefixes that only expose directory listings or metadata (no file content),
 * so ancestors of allowed paths may be navigated through them.
 */
const NAVIGATION_PREFIXES: ReadonlySet<ContentRoutePrefix> = new Set([
  '/api/path',
  '/api/link-info',
]);

/** Parsed content route: the matched prefix and the decoded content path. */
export interface ContentRoute {
  prefix: ContentRoutePrefix;
  path: string;
}

/**
 * Map an API request URL to the content path it addresses.
 * Returns null for API routes that do not address filesystem content.
 */
export function parseContentRoute(url: string): ContentRoute | null {
  const pathname = url.split('?')[0];
  for (const prefix of CONTENT_ROUTE_PREFIXES) {
    if (pathname !== prefix && !pathname.startsWith(prefix + '/')) continue;
    const rest = pathname.slice(prefix.length);
    let decoded: string;
    try {
      decoded = decodeURIComponent(rest);
    } catch {
      // Malformed percent-encoding: use the raw path
      decoded = rest;
    }
    return { prefix, path: decoded || '/' };
  }
  return null;
}

/**
 * True when a content path contains a `..` segment (either separator).
 * Such paths can resolve outside the location they appear to address.
 */
export function hasTraversalSegment(contentPath: string): boolean {
  return contentPath.split(/[\\/]/).some((segment) => segment === '..');
}

/** True when `scopes` grant access to the content at `urlPath`. */
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
 * Build a predicate deciding whether an archive entry (path relative to the
 * archived directory at `dirUrlPath`) may be included for `scopes`.
 * Files must be in scope; directories must be navigable.
 */
export function archiveEntryFilter(
  dirUrlPath: string,
  scopes: NormalizedScopes | null | undefined,
): (relativeName: string, isDirectory: boolean) => boolean {
  const base = dirUrlPath.replace(/\/+$/, '');
  return (relativeName, isDirectory) => {
    if (!scopes) return true;
    const entryUrlPath = `${base}/${relativeName.replace(/\\/g, '/')}`;
    return isDirectory
      ? canNavigatePath(entryUrlPath, scopes)
      : canAccessPath(entryUrlPath, scopes);
  };
}

/**
 * True when `scopes` permit the request addressed by `route`.
 * Navigation routes allow ancestors of in-scope paths; all other content
 * routes require the path itself to be in scope. Non-content routes
 * (`route === null`) are not path-scoped here.
 */
export function scopesAllowRoute(
  route: ContentRoute | null,
  scopes: NormalizedScopes | null | undefined,
): boolean {
  if (!route || !scopes) return true;
  return NAVIGATION_PREFIXES.has(route.prefix)
    ? canNavigatePath(route.path, scopes)
    : canAccessPath(route.path, scopes);
}
