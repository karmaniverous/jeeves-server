/**
 * URL helpers shared by the tools: public-URL rewriting of results, browse path normalisation and absolute URLs. Pure.
 *
 * @packageDocumentation
 */

/** Check that the character after a prefix match is a valid URL boundary. */
function isOriginBoundary(url: string, originLength: number): boolean {
  if (url.length <= originLength) return true;
  const next = url[originLength];
  return next === '/' || next === '?' || next === '#';
}

/** Lazily resolves the server's public URL (`undefined` when unknown). */
export type PublicUrlResolver = () => string | undefined;

/**
 * Rewrite a single URL string: replace the baseUrl origin with publicUrl origin.
 * Only rewrites URLs that start with the baseUrl origin.
 */
export function rewriteUrl(
  url: string,
  baseUrl: string,
  publicUrl: string,
): string {
  const base = new URL(baseUrl);
  const pub = new URL(publicUrl);
  if (
    url.startsWith(base.origin) &&
    isOriginBoundary(url, base.origin.length)
  ) {
    return pub.origin + url.slice(base.origin.length);
  }
  return url;
}

/**
 * Deep-walk a JSON-serializable value and rewrite any string that starts
 * with the baseUrl origin to use the publicUrl origin instead.
 */
export function rewriteUrlsInData(
  data: unknown,
  baseUrl: string,
  publicUrl: string | undefined,
): unknown {
  if (!publicUrl) return data;

  const baseOrigin = new URL(baseUrl).origin;
  const pubOrigin = new URL(publicUrl).origin;

  function walk(value: unknown): unknown {
    if (typeof value === 'string') {
      if (
        value.startsWith(baseOrigin) &&
        isOriginBoundary(value, baseOrigin.length)
      ) {
        return pubOrigin + value.slice(baseOrigin.length);
      }
      return value;
    }
    if (Array.isArray(value)) {
      return value.map(walk);
    }
    if (value !== null && typeof value === 'object') {
      const result: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        result[k] = walk(v);
      }
      return result;
    }
    return value;
  }

  return walk(data);
}

/** Normalize a browse path param: strip leading slash. */
export function normalizePath(params: Record<string, unknown>): string {
  return String(params.path).replace(/^\//, '');
}

/** Resolve a possibly-relative API URL against the configured base URL. */
export function toAbsoluteUrl(baseUrl: string, url: string): string {
  return new URL(url, baseUrl).toString();
}
