/**
 * Content negotiation for browser routes that also answer JSON clients: does an `Accept` header prefer `application/json` to HTML? Pure.
 *
 * @packageDocumentation
 */

/** How an `Accept` header ranks one media type. */
interface Match {
  /** Quality, 0 to 1 (0: not acceptable). */
  q: number;
  /** Specificity of the matching range: 0 exact, 1 `type/*`, 2 `*\/*`. */
  rank: number;
  /** Position of the matching range in the header. */
  order: number;
}

/**
 * How an `Accept` header ranks a media type: by its most specific matching
 * range (RFC 9110 12.5.1).
 *
 * @param entries - The header's comma-separated entries.
 * @param mediaType - The media type, e.g. `text/html`.
 * @returns The match; `q` 0 when no range matches.
 */
function match(entries: string[], mediaType: string): Match {
  const ranges = [mediaType, `${mediaType.split('/')[0] ?? ''}/*`, '*/*'];
  let best: Match = { q: 0, rank: ranges.length, order: entries.length };
  entries.forEach((entry, order) => {
    const [range = '', ...params] = entry.split(';').map((p) => p.trim());
    const rank = ranges.indexOf(range.toLowerCase());
    if (rank < 0 || rank >= best.rank) return;
    const q = params.find((p) => p.toLowerCase().startsWith('q='));
    const value = q ? Number(q.slice(2)) : 1;
    best = { q: Number.isFinite(value) ? value : 0, rank, order };
  });
  return best;
}

/**
 * Whether the client prefers `application/json` to `text/html`. As
 * Fastify's negotiator ranks them: higher quality, then the more specific
 * range, then the earlier one in the header. A missing header, `*\/*` or
 * a full tie means HTML (the browser case).
 *
 * @param accept - The `Accept` header value(s).
 * @returns True for a JSON client.
 */
export function prefersJson(accept: string | string[] | undefined): boolean {
  const header = Array.isArray(accept) ? accept.join(',') : (accept ?? '');
  const entries = header.split(',');
  const json = match(entries, 'application/json');
  const html = match(entries, 'text/html');
  if (json.q <= 0) return false;
  if (json.q !== html.q) return json.q > html.q;
  if (json.rank !== html.rank) return json.rank < html.rank;
  return json.order < html.order;
}
