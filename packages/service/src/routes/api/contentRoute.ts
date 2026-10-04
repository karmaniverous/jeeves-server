/**
 * Maps API request URLs to the filesystem content path they address, for
 * auth and scope checks. Pure functions; no I/O.
 *
 * @packageDocumentation
 */

/**
 * API route prefixes whose remaining URL path addresses filesystem content.
 * The content path is the URL path with the prefix removed. Longer prefixes
 * sharing a stem (`/api/export-cache`) must precede shorter ones.
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

/** Percent-decode a URL path, falling back to the raw path if malformed. */
function decodePath(rawPath: string): string {
  try {
    return decodeURIComponent(rawPath);
  } catch {
    return rawPath;
  }
}

/**
 * Map an API request URL to the content path it addresses.
 * Returns null for API routes that do not address filesystem content.
 */
export function parseContentRoute(url: string): ContentRoute | null {
  const pathname = url.split('?')[0];
  for (const prefix of CONTENT_ROUTE_PREFIXES) {
    if (pathname !== prefix && !pathname.startsWith(prefix + '/')) continue;
    return { prefix, path: decodePath(pathname.slice(prefix.length)) || '/' };
  }
  return null;
}

/**
 * The path that URL keys are verified against for an API request: the
 * content path for content routes, `/` for `/api/drives`, otherwise the
 * decoded request path itself.
 */
export function keyAuthPath(url: string, route: ContentRoute | null): string {
  if (route) return route.path;
  const pathname = url.split('?')[0];
  return pathname === '/api/drives' ? '/' : decodePath(pathname);
}

/** True when `route` only lists or describes content (see NAVIGATION_PREFIXES). */
export function isNavigationRoute(route: ContentRoute): boolean {
  return NAVIGATION_PREFIXES.has(route.prefix);
}

/**
 * True when a content path contains a `..` segment (either separator).
 * Such paths can resolve outside the location they appear to address.
 */
export function hasTraversalSegment(contentPath: string): boolean {
  return contentPath.split(/[\\/]/).some((segment) => segment === '..');
}
