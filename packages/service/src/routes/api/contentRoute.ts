/**
 * Maps a request matched to a catalog entry to the filesystem content path it addresses, for access and scope checks: the decoded `*` value of a content or navigation entry, or the entry's fixed `contentPath`. Pure functions; no I/O.
 *
 * @packageDocumentation
 */

import type { CatalogMatch } from '../../api/catalogMatch.js';
import { hasContentPath, type RouteAccess } from '../../api/routeAccess.js';

/** The content path a request addresses. */
export interface ContentRoute {
  /** Decoded content path (`/` for the root). */
  path: string;
}

/** Percent-decode a URL path, falling back to the raw path if malformed. */
function decodePath(rawPath: string): string {
  try {
    return decodeURIComponent(rawPath);
  } catch {
    return rawPath;
  }
}

/**
 * The content path of a request to a catalog entry.
 *
 * @param match - The matched entry and its raw `*` value.
 * @param access - The entry's access.
 * @returns The content path, or null for entries that address none.
 */
export function parseContentRoute(
  match: CatalogMatch,
  access: RouteAccess,
): ContentRoute | null {
  if (!hasContentPath(access)) return null;
  if (access.contentPath) return { path: access.contentPath };
  return { path: decodePath(`/${match.wildcard ?? ''}`) };
}

/**
 * True when a content path contains a `..` segment (either separator).
 * Such paths can resolve outside the location they appear to address.
 */
export function hasTraversalSegment(contentPath: string): boolean {
  return contentPath.split(/[\\/]/).some((segment) => segment === '..');
}
