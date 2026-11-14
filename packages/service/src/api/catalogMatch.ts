/**
 * Maps a request (method and URL) to the server catalog entry whose route it addresses, from the catalog's own paths (`:param` segments and a trailing `*`), plus the raw `*` value. Pure.
 *
 * @remarks
 * `HEAD` matches the `GET` entry (Fastify answers `HEAD` from `GET`
 * routes). A wildcard route also matches its bare prefix (`/api/path`
 * addresses the root), as the content routes always have.
 *
 * @packageDocumentation
 */

import {
  SERVER_CATALOG,
  type ServerEntryName,
} from '@karmaniverous/jeeves-server-core';

/** A request matched to a catalog entry. */
export interface CatalogMatch {
  /** The entry. */
  name: ServerEntryName;
  /** The raw (still percent-encoded) `*` value, for wildcard entries. */
  wildcard?: string;
}

/** A compiled entry route. */
interface EntryMatcher {
  name: ServerEntryName;
  method: string;
  pattern: RegExp;
  wildcard: boolean;
}

/** Escape a static path segment for a regular expression. */
const escape = (segment: string): string =>
  segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Compile a catalog path (Fastify syntax) to a regular expression whose
 * one optional group is the `*` value.
 *
 * @param path - Catalog path.
 * @returns The pattern.
 */
export function compileRoutePath(path: string): RegExp {
  const wildcard = path.endsWith('/*');
  const segments = (wildcard ? path.slice(0, -2) : path).split('/');
  const body = segments
    .map((segment) => (segment.startsWith(':') ? '[^/]+' : escape(segment)))
    .join('/');
  return new RegExp(`^${body}${wildcard ? '(?:/(.*))?' : ''}$`, 'u');
}

const MATCHERS: readonly EntryMatcher[] = SERVER_CATALOG.entries.map(
  (entry) => ({
    name: entry.name,
    method: entry.method,
    pattern: compileRoutePath(entry.path),
    wildcard: entry.path.endsWith('/*'),
  }),
);

/**
 * The catalog entry a request addresses.
 *
 * @param method - HTTP method.
 * @param url - Request URL (path and query).
 * @returns The entry and its raw `*` value, or null for any other route.
 */
export function matchCatalogRoute(
  method: string,
  url: string,
): CatalogMatch | null {
  const pathname = url.split('?')[0];
  const wanted = method === 'HEAD' ? 'GET' : method;
  for (const matcher of MATCHERS) {
    if (matcher.method !== wanted) continue;
    const match = matcher.pattern.exec(pathname);
    if (!match) continue;
    return matcher.wildcard
      ? { name: matcher.name, wildcard: match.at(1) ?? '' }
      : { name: matcher.name };
  }
  return null;
}
