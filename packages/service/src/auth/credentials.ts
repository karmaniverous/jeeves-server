/**
 * Resolves the credentials a request carries, by kind (Decision 8): identities (session cookie, machine insider key, insider-seed insider key) verified as identities, share credentials (path, expiring and deep keys) verified against a content path, and the machine seed and event key of the key-exchange and webhook routes. Pure apart from reading the request.
 *
 * @packageDocumentation
 */

import { getUrlKey } from '@karmaniverous/jeeves-server-core';
import type { FastifyRequest } from 'fastify';

import { Unauthorized } from '../api/errors.js';
import type {
  NormalizedScopes,
  ResolvedKey,
  RuntimeConfig,
} from '../config/types.js';
import { timingSafeEqual } from '../util/crypto.js';
import { verifyKey } from './keys.js';
import {
  type AuthQuery,
  extractDeepParams,
  resolveInsiderKeyAuth,
  resolveKeyAuth,
  resolveSessionAuth,
} from './resolve.js';

/** Kinds of identity credential. */
export type IdentityKind = 'session' | 'machineKey' | 'loginSeedKey';

/** Who is calling: a verified identity credential. */
export interface Identity {
  /** The credential that identified the caller. */
  kind: IdentityKind;
  /** Insider email (sessions, insider-seed keys) or machine key name. */
  name: string;
  /** Insider email; absent for machine keys. */
  email?: string;
  /** The seed the identity signs with. */
  seed: string;
  /** The identity's scopes (null: none configured). */
  scopes: NormalizedScopes | null;
  /** Age of the insider's key (sessions only). */
  keyAge?: string | null;
}

/** A share credential verified for a content path. */
export interface ShareGrant {
  /** The signer's seed. */
  seed: string;
  /** The signer's scopes. */
  scopes: NormalizedScopes | null;
  /** The (ancestor) path a path key matched. */
  matchedPath: string | null;
  /** The deep-share parameters of a deep key. */
  deepShareParams?: { d: string; dirs: string; s: string };
}

/**
 * The identity a request carries: its session, else a machine insider key
 * in `k`, else (only when `loginSeedKey`) an insider-seed insider key.
 * Verified as identities, never against a path.
 *
 * @param config - Runtime config.
 * @param request - The request (cookies).
 * @param query - The raw query.
 * @param loginSeedKey - Whether insider-seed insider keys count.
 * @returns The identity, or undefined.
 */
export function resolveIdentity(
  config: RuntimeConfig,
  request: FastifyRequest,
  query: AuthQuery,
  loginSeedKey: boolean,
): Identity | undefined {
  const session = resolveSessionAuth(config, request);
  if (session.valid && session.seed && session.email)
    return {
      kind: 'session',
      name: session.email,
      email: session.email,
      seed: session.seed,
      scopes: session.scopes ?? null,
      keyAge: session.keyAge ?? null,
    };

  const key = getUrlKey(query);
  if (!key) return undefined;
  const result = resolveInsiderKeyAuth(config, key);
  if (!result.valid || !result.seed) return undefined;
  if (result.email === undefined)
    return {
      kind: 'machineKey',
      name: result.keyName ?? '',
      seed: result.seed,
      scopes: result.scopes ?? null,
    };
  return loginSeedKey
    ? {
        kind: 'loginSeedKey',
        name: result.email,
        email: result.email,
        seed: result.seed,
        scopes: result.scopes ?? null,
      }
    : undefined;
}

/**
 * The share credential in the query, verified for `contentPath`: a path,
 * expiring or deep key signed by a machine key or an insider, within the
 * signer's scopes.
 *
 * @param config - Runtime config.
 * @param contentPath - The decoded content path.
 * @param query - The raw query.
 * @returns The grant, or undefined.
 */
export function verifyShareCredential(
  config: RuntimeConfig,
  contentPath: string,
  query: AuthQuery,
): ShareGrant | undefined {
  const deepShareParams = extractDeepParams(query);
  const result = resolveKeyAuth(
    config,
    contentPath,
    getUrlKey(query),
    query.exp,
    deepShareParams,
  );
  if (!result.valid || result.mode !== 'outsider' || !result.seed)
    return undefined;
  return {
    seed: result.seed,
    scopes: result.scopes ?? null,
    matchedPath: result.matchedPath ?? null,
    ...(deepShareParams ? { deepShareParams } : {}),
  };
}

/**
 * The machine key whose raw seed is the `X-API-Key` header.
 *
 * @param config - Runtime config.
 * @param provided - The header.
 * @returns The key.
 * @throws `SERVER_UNAUTHORIZED` (401) when the header is missing or matches
 *   no key.
 */
export function machineSeedFor(
  config: RuntimeConfig,
  provided: string | string[] | undefined,
): ResolvedKey {
  if (typeof provided !== 'string' || !provided)
    throw new Unauthorized('X-API-Key header required');
  const matched = config.resolvedKeys.find((rk) =>
    timingSafeEqual(provided, rk.seed),
  );
  if (!matched) throw new Unauthorized('Invalid API key');
  return matched;
}

/**
 * The machine key a webhook's `k` is valid for `/event` under.
 *
 * @param config - Runtime config.
 * @param query - The raw query.
 * @returns The key's name.
 * @throws `SERVER_UNAUTHORIZED` (401) otherwise.
 */
export function eventKeyFor(config: RuntimeConfig, query: AuthQuery): string {
  const result = verifyKey(
    config.resolvedKeys,
    '/event',
    getUrlKey(query),
    undefined,
  );
  if (!result.valid || !result.keyName) throw new Unauthorized('Unauthorized');
  return result.keyName;
}
