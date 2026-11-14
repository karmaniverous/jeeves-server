/**
 * Client credentials (`ServerAuth`) and how each reaches a request: a key through jeeves' catalog client (`k`, on the entries that list it), a share credential or a browser session through a wrapper around `fetch`. Pure apart from wrapping `fetch`.
 *
 * @packageDocumentation
 */

import type { ClientAuth } from '@karmaniverous/jeeves/catalog';

import { appendQuery } from './query.js';
import { invalidOptions } from './ServerError.js';

/**
 * A share-link credential: the parameters of a `/browse` share URL. `k` is
 * the outsider key; `exp` marks an expiring key; `d`, `dirs` and `s` are a
 * deep share's depth, directory flag and path stack.
 */
export interface ShareCredential {
  /** Outsider key. */
  k: string;
  /** Expiry (Unix ms) of an expiring key. */
  exp?: string;
  /** Deep share depth. */
  d?: string;
  /** Deep share: `1` when directories below the shared path open. */
  dirs?: string;
  /** Deep share path stack. */
  s?: string;
}

/**
 * How the client authenticates.
 *
 * - `{ key }`: an insider or machine key, sent as `k` to every entry whose
 *   `auth` lists it (not to public entries). Derive it yourself, e.g. with
 *   `computeInsiderKey(seed)` from `@karmaniverous/jeeves-server-core`; the
 *   SDK takes no seeds, so it stays browser-safe.
 * - `{ share }`: a share-link credential, added to every request's query.
 * - `{ session: true }`: a browser's session cookie, sent with
 *   `credentials: 'same-origin'`.
 */
export type ServerAuth =
  { key: string } | { share: ShareCredential } | { session: true };

/** The share parameters, in the order a share URL carries them. */
const SHARE_PARAMS = ['k', 'exp', 'd', 'dirs', 's'] as const;

/**
 * A share credential's parameters as `[name, value]` pairs (absent fields
 * omitted).
 *
 * @param share - The credential.
 * @returns The pairs.
 */
export function shareParams(share: ShareCredential): [string, string][] {
  return SHARE_PARAMS.flatMap((name) => {
    const value = share[name];
    return value === undefined ? [] : [[name, value] as [string, string]];
  });
}

/**
 * Check a credential.
 *
 * @param auth - The credential.
 * @returns It.
 * @throws {@link ServerError} `invalid_options` for an empty key or share
 *   key, or an object of none of the three kinds.
 */
export function checkAuth(auth: ServerAuth): ServerAuth {
  if ('key' in auth) {
    if (typeof auth.key !== 'string' || auth.key === '')
      throw invalidOptions('auth.key must be a non-empty string');
    return auth;
  }
  if ('share' in auth) {
    if (typeof auth.share.k !== 'string' || auth.share.k === '')
      throw invalidOptions('auth.share.k must be a non-empty string');
    return auth;
  }
  if ((auth as { session?: unknown }).session !== true)
    throw invalidOptions(
      'auth must be { key }, { share } or { session: true }',
    );
  return auth;
}

/**
 * The credential jeeves' catalog client attaches itself.
 *
 * @param auth - The client's credential.
 * @returns `k` as a query credential for a key, else nothing.
 */
export function catalogAuth(
  auth: ServerAuth | undefined,
): ClientAuth | undefined {
  return auth !== undefined && 'key' in auth
    ? { query: { name: 'k', value: auth.key } }
    : undefined;
}

/** A `fetch`-compatible function (the global `fetch` by default). */
export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

/**
 * Adapt a {@link FetchLike} to the `fetch` signature jeeves' catalog client
 * takes, applying a share or session credential: a share credential's
 * parameters are added to every request URL (parameters already present
 * stay as they are); a session sets `credentials: 'same-origin'`.
 *
 * @param fetchImpl - The caller's fetch.
 * @param auth - The client's credential.
 * @returns A `typeof fetch` calling `fetchImpl`.
 */
export function withAuth(
  fetchImpl: FetchLike,
  auth: ServerAuth | undefined,
): typeof fetch {
  const share =
    auth !== undefined && 'share' in auth ? shareParams(auth.share) : [];
  const session = auth !== undefined && 'session' in auth;
  return (input, init) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    return fetchImpl(appendQuery(url, share), {
      ...init,
      ...(session ? { credentials: 'same-origin' } : {}),
    });
  };
}
