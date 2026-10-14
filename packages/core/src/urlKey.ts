/**
 * URL auth-key query parameter names and a reader that accepts both: `k`
 * (generated since 3.15.0) and the legacy `key`. Pure; no I/O.
 *
 * @remarks
 * OpenClaw masks the value of any query parameter named `key` in
 * model-visible tool output, so agents could not relay share links (#279).
 * Generated URLs therefore carry the key as `k`. `key` is still accepted
 * everywhere so existing links, bookmarks and webhook URLs keep working.
 *
 * @packageDocumentation
 */

/** Query parameter name used for auth keys in every generated URL. */
export const URL_KEY_PARAM = 'k';

/** Legacy query parameter name, still accepted for backward compatibility. */
export const LEGACY_URL_KEY_PARAM = 'key';

/** First non-empty string in a parsed query value (string or repeated). */
function firstString(value: unknown): string | undefined {
  const candidate: unknown = Array.isArray(value) ? value[0] : value;
  return typeof candidate === 'string' && candidate !== ''
    ? candidate
    : undefined;
}

/**
 * Read the auth key from a parsed query object or `URLSearchParams`.
 * `k` wins when both names are present; empty values count as absent.
 *
 * @param query - Parsed query (e.g. Fastify `request.query`) or search params.
 * @returns The key, or `undefined` when neither parameter carries one.
 */
export function getUrlKey(query: unknown): string | undefined {
  if (query instanceof URLSearchParams) {
    return (
      firstString(query.get(URL_KEY_PARAM)) ??
      firstString(query.get(LEGACY_URL_KEY_PARAM))
    );
  }
  if (query === null || typeof query !== 'object') return undefined;
  const record = query as Record<string, unknown>;
  return (
    firstString(record[URL_KEY_PARAM]) ??
    firstString(record[LEGACY_URL_KEY_PARAM])
  );
}
