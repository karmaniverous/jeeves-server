/**
 * Auth query strings for generated share URLs. Pure; no I/O.
 *
 * Every generated URL carries its key as `k` (`URL_KEY_PARAM`, #279). Deep
 * share URLs always carry `d` (also `d=0`), which verification needs to
 * recognise a deep key (#282).
 *
 * @packageDocumentation
 */

import { URL_KEY_PARAM } from '@karmaniverous/jeeves-server-core';

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
    `s=${params.stack}`,
  ];
  if (params.exp) parts.push(`exp=${params.exp}`);
  return parts.join('&');
}
