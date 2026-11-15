/**
 * Maps a request matched to a catalog entry to the filesystem content path it addresses, for access and scope checks: the `*` value (as Fastify decoded it) of a content or navigation entry, or the entry's fixed `contentPath`. Pure functions; no I/O.
 *
 * @packageDocumentation
 */

import type { CatalogMatch } from '../../api/catalogMatch.js';
import { InvalidPath } from '../../api/errors.js';
import { hasContentPath, type RouteAccess } from '../../api/routeAccess.js';

/** The content path a request addresses. */
export interface ContentRoute {
  /** Decoded content path (`/` for the root). */
  path: string;
}

/**
 * The content path of a request to a catalog entry.
 *
 * @param match - The matched entry and its decoded `*` value.
 * @param access - The entry's access.
 * @returns The content path, or null for entries that address none.
 */
export function parseContentRoute(
  match: CatalogMatch,
  access: RouteAccess,
): ContentRoute | null {
  if (!hasContentPath(access)) return null;
  if (access.contentPath) return { path: access.contentPath };
  return { path: `/${match.wildcard ?? ''}` };
}

/**
 * True when a content path contains a `..` segment (either separator).
 * Such paths can resolve outside the location they appear to address.
 */
export function hasTraversalSegment(contentPath: string): boolean {
  return contentPath.split(/[\\/]/).some((segment) => segment === '..');
}

/**
 * Refuse a path with a `..` segment ({@link hasTraversalSegment}).
 *
 * @param contentPath - The decoded path (route or request body).
 * @throws `SERVER_INVALID_PATH` (400) when it has one.
 */
export function requireNoTraversal(contentPath: string): void {
  if (hasTraversalSegment(contentPath)) throw new InvalidPath('Invalid path');
}

/**
 * Refuse a share target with a `..` segment, or a literal `%2e%2e` one (any
 * case): the share URL carries the path to a browser, which would read the
 * encoded form as `..`.
 *
 * @param targetPath - The share target as the request body gives it.
 * @throws `SERVER_INVALID_PATH` (400) when it has either.
 */
export function requireNoShareTraversal(targetPath: string): void {
  requireNoTraversal(targetPath);
  if (
    targetPath
      .split(/[\\/]/)
      .some((segment) => segment.toLowerCase() === '%2e%2e')
  )
    throw new InvalidPath('Invalid path');
}
