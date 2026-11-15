/**
 * Auth query strings for generated share URLs. Pure; no I/O.
 *
 * Every generated URL carries its key as `k` (`URL_KEY_PARAM`, #279). Deep
 * share URLs always carry `d` (also `d=0`), which verification needs to
 * recognise a deep key (#282), and their stack `s` percent-encoded: the
 * lz-string URL alphabet includes `+`, which a query string decodes as a
 * space.
 *
 * @packageDocumentation
 */

import {
  LEGACY_URL_KEY_PARAM,
  URL_KEY_PARAM,
} from '@karmaniverous/jeeves-server-core';

import type { DeepShareParams } from './crypto.js';

/** Auth query for a path key: `k=<key>`, plus `exp=<exp>` when set. */
export function pathKeyQuery(key: string, exp?: string): string {
  const query = `${URL_KEY_PARAM}=${key}`;
  return exp ? `${query}&exp=${exp}` : query;
}

/**
 * Auth query for a deep share key: `k`, `d`, `dirs` and `s`, plus `exp`
 * when set.
 */
export function deepShareQuery(key: string, params: DeepShareParams): string {
  const parts = [
    `${URL_KEY_PARAM}=${key}`,
    `d=${String(params.depth)}`,
    `dirs=${params.dirs ? '1' : '0'}`,
    `s=${encodeURIComponent(params.stack)}`,
  ];
  if (params.exp) parts.push(`exp=${params.exp}`);
  return parts.join('&');
}

/** Query parameters that carry a share credential. */
const CREDENTIAL_PARAMS = new Set([
  URL_KEY_PARAM,
  LEGACY_URL_KEY_PARAM,
  'exp',
  'd',
  'dirs',
  's',
]);

/**
 * Give a URL a share credential, replacing any credential it carries and
 * keeping its other query parameters (e.g. `download=1`, #316) as written,
 * before the credential; the fragment stays last.
 *
 * @param url - A root-relative URL, optionally with a query and fragment.
 * @param credential - The credential query (`pathKeyQuery`, `deepShareQuery`).
 * @returns The URL with the credential.
 */
export function withCredentialQuery(url: string, credential: string): string {
  const hashIndex = url.indexOf('#');
  const beforeHash = hashIndex >= 0 ? url.slice(0, hashIndex) : url;
  const fragment = hashIndex >= 0 ? url.slice(hashIndex) : '';
  const queryIndex = beforeHash.indexOf('?');
  const base = queryIndex >= 0 ? beforeHash.slice(0, queryIndex) : beforeHash;
  const kept =
    queryIndex >= 0
      ? beforeHash
          .slice(queryIndex + 1)
          .split('&')
          .filter((pair) => {
            if (pair === '') return false;
            const name = pair.split('=')[0];
            try {
              return !CREDENTIAL_PARAMS.has(decodeURIComponent(name));
            } catch {
              return true;
            }
          })
      : [];
  return `${base}?${[...kept, credential].join('&')}${fragment}`;
}
