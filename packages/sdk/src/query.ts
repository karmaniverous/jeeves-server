/**
 * Query-string helpers shared by the share-credential `fetch` wrapper and the link helpers: append parameters to a URL without touching what it already carries. Pure.
 *
 * @packageDocumentation
 */

/** The parts of a URL string around its query. */
export interface UrlParts {
  /** Everything before the query: scheme, authority (when absolute) and path. */
  base: string;
  /** The path (from the first `/` after the authority). */
  path: string;
  /** The query with its `?`, or `''`. */
  query: string;
  /** The fragment with its `#`, or `''`. */
  fragment: string;
}

/** Scheme and authority (optional), path, query, fragment: matches any string. */
const URL_PARTS =
  /^((?:[a-z][a-z\d+.-]*:)?(?:\/\/[^/?#]*)?)([^?#]*)(\?[^#]*)?(#.*)?$/is;

/**
 * Split an absolute or root-relative URL string, keeping every part exactly
 * as written (no re-encoding).
 *
 * @param url - The URL.
 * @returns Its parts.
 */
export function splitUrl(url: string): UrlParts {
  const [, origin = '', path = '', query = '', fragment = ''] =
    URL_PARTS.exec(url)!;
  return { base: origin + path, path, query, fragment };
}

/**
 * Names of the parameters a query string carries.
 *
 * @param query - The query, with or without `?`.
 * @returns The decoded names.
 */
function namesIn(query: string): Set<string> {
  return new Set(new URLSearchParams(query).keys());
}

/**
 * Append parameters to a URL. Parameters it already carries keep their
 * value and are not added again; the rest of the URL (including the
 * encoding of its existing query and its fragment) is unchanged. Names and
 * values are `encodeURIComponent`-encoded.
 *
 * @param url - The URL (absolute or root-relative).
 * @param params - `[name, value]` pairs, in order.
 * @returns The URL with the new parameters.
 */
export function appendQuery(
  url: string,
  params: readonly (readonly [string, string])[],
): string {
  const { base, query, fragment } = splitUrl(url);
  const present = namesIn(query);
  const added = params
    .filter(([name]) => !present.has(name))
    .map(
      ([name, value]) =>
        `${encodeURIComponent(name)}=${encodeURIComponent(value)}`,
    );
  if (added.length === 0) return url;
  const separator = query === '' ? '?' : query === '?' ? '' : '&';
  return `${base}${query}${separator}${added.join('&')}${fragment}`;
}
