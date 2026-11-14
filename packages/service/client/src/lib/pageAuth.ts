/**
 * The page's credential: the share-link parameters of the URL the SPA was
 * opened with (`k`, or the legacy `key`, plus `exp`, `d`, `dirs`, `s`), as
 * the SDK's share credential and as the auth suffix SPA routes carry. Pure.
 */

import {
  type ServerAuth,
  type ShareCredential,
  withShareCredential,
} from '@karmaniverous/jeeves-server-sdk';

/** Share parameters beside the key, in the order route links carry them. */
const SHARE_FIELDS = ['d', 'dirs', 's', 'exp'] as const;

/**
 * The share credential in a page's query string: the URL key (`k`, falling
 * back to the legacy `key`) and the share parameters present.
 *
 * @param search - The page's query string (`window.location.search`).
 * @returns The credential, or `undefined` when the page has no URL key.
 */
export function pageShareCredential(
  search: string,
): ShareCredential | undefined {
  const params = new URLSearchParams(search);
  const k = params.get('k') || params.get('key');
  if (!k) return undefined;
  const credential: ShareCredential = { k };
  for (const field of SHARE_FIELDS) {
    const value = params.get(field);
    if (value !== null) credential[field] = value;
  }
  return credential;
}

/**
 * How the SPA authenticates its API calls: the share credential when the
 * page was opened from a share link, else the browser session.
 *
 * @param share - The page's share credential, if any.
 * @returns The SDK credential.
 */
export function pageAuth(share: ShareCredential | undefined): ServerAuth {
  return share ? { share } : { session: true };
}

/**
 * The auth query an SPA route link carries so it still works when refreshed
 * or copied: the URL key as `k` plus the share parameters. Empty when the
 * page has no key.
 *
 * @param search - The page's query string.
 * @returns The query, without `?`.
 */
export function buildAuthSuffix(search: string): string {
  const share = pageShareCredential(search);
  if (!share) return '';
  const params = new URLSearchParams({ k: share.k });
  for (const field of SHARE_FIELDS) {
    const value = share[field];
    if (value !== undefined) params.set(field, value);
  }
  return params.toString();
}

/**
 * A URL with the page's share credential added (parameters the URL already
 * carries are kept), for fetches outside the SDK such as embedded images.
 *
 * @param url - Any URL.
 * @param share - The page's share credential, if any.
 * @returns The URL, unchanged without a credential.
 */
export function withPageCredential(
  url: string,
  share: ShareCredential | undefined,
): string {
  return share ? withShareCredential(url, share) : url;
}
