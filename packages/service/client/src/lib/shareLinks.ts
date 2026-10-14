/**
 * Derive the copyable page, raw and event URLs from a server-generated
 * share URL. Pure URL parsing; the auth query (`k`, deep share params,
 * `exp`) is carried over unchanged.
 */

import type { ShareSettings } from './api';

/** Kind of link the Link dropdown copies. */
export type LinkType = 'page' | 'raw' | 'event';

/**
 * Build the absolute URL to copy for `type` from a share URL returned by
 * `/api/share` (relative `/browse/...?k=...` or absolute).
 */
export function deriveShareLink(
  origin: string,
  shareUrl: string,
  type: LinkType,
): string {
  const url = new URL(shareUrl, origin);
  if (type === 'raw') {
    url.pathname = url.pathname.replace(/^\/browse\//, '/api/raw/');
  } else if (type === 'event') {
    url.pathname = '/event';
    url.hash = '';
  }
  return url.toString();
}

/**
 * Depth and `dirs` to request for a share. A document share sends its depth
 * (when above zero) and `dirs` (when set). A directory share from the UI
 * sends neither, so it is always a plain tree share; deep directory shares
 * are made through the API or the plugin.
 */
export function shareDepthOptions(
  settings: Pick<ShareSettings, 'depth' | 'dirs'>,
  isDirectory?: boolean,
): { depth?: number; dirs?: true } {
  if (isDirectory) return {};
  return {
    ...(settings.depth > 0 ? { depth: settings.depth } : {}),
    ...(settings.dirs ? { dirs: true as const } : {}),
  };
}
