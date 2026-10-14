/**
 * How a directory listing entry is opened. In listings reached via a deep
 * share link each entry carries its own share URL (opening it consumes
 * depth); without one it is plain text. Elsewhere entries are SPA routes;
 * under a plain outsider share the route keeps the share's auth query, so
 * the child URL still works when refreshed or copied.
 */

import { buildAuthSuffix } from './api';

/** Link target for a directory entry. */
export type EntryLinkTarget =
  | { kind: 'route'; to: string }
  | { kind: 'share'; href: string }
  | { kind: 'none' };

/**
 * Decide how to open an entry at `entryPath` (no leading slash) given the
 * listing's `shareUrl` for it (`undefined` outside deep-share listings) and
 * the current page's query string (`search`). Route links carry the current
 * URL key (`k`, or the legacy `key`, sent as `k`) and its expiry; pages
 * without a URL key (session browsing) get a bare route.
 */
export function entryLinkTarget(
  entryPath: string,
  shareUrl: string | null | undefined,
  search = '',
): EntryLinkTarget {
  if (shareUrl === undefined) {
    const auth = buildAuthSuffix(search);
    const to = `/browse/${entryPath}`;
    return { kind: 'route', to: auth ? `${to}?${auth}` : to };
  }
  if (shareUrl === null) return { kind: 'none' };
  return { kind: 'share', href: shareUrl };
}
