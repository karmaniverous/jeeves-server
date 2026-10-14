/**
 * How a directory listing entry is opened. In listings reached via a deep
 * share link each entry carries its own share URL (opening it consumes
 * depth); without one it is plain text. Elsewhere entries are SPA routes.
 */

/** Link target for a directory entry. */
export type EntryLinkTarget =
  | { kind: 'route'; to: string }
  | { kind: 'share'; href: string }
  | { kind: 'none' };

/**
 * Decide how to open an entry at `entryPath` (no leading slash) given the
 * listing's `shareUrl` for it (`undefined` outside deep-share listings).
 */
export function entryLinkTarget(
  entryPath: string,
  shareUrl: string | null | undefined,
): EntryLinkTarget {
  if (shareUrl === undefined) return { kind: 'route', to: `/browse/${entryPath}` };
  if (shareUrl === null) return { kind: 'none' };
  return { kind: 'share', href: shareUrl };
}
