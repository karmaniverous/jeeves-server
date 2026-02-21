/**
 * Unified auth resolution — single function to resolve authentication
 * from any combination of key params, session cookies, and insider seeds.
 *
 * Replaces duplicated auth resolution logic across middleware, keys, sharing,
 * and auth-status routes.
 */

import type { FastifyRequest } from 'fastify';

import type {
  AccessMode,
  NormalizedScopes,
  ResolvedInsider,
  RuntimeConfig,
} from '../config/types.js';
import { computeInsiderKey, timingSafeEqual } from '../util/crypto.js';
import { formatRelativeTime } from '../util/formatters.js';
import { verifyKey } from './keys.js';
import { COOKIE_NAME, verifySessionCookie } from './session.js';

export interface AuthResult {
  valid: boolean;
  mode?: AccessMode;
  seed?: string;
  scopes?: NormalizedScopes | null;
  email?: string;
  keyAge?: string | null;
  keyName?: string | null;
  matchedPath?: string | null;
  deepShareParams?: { d: string; dirs: string; s: string };
}

const FAIL: AuthResult = { valid: false };

/**
 * Resolve auth from a key parameter (machine API keys + insider outsider keys).
 * Checks both resolvedKeys and resolvedInsiders.
 */
export function resolveKeyAuth(
  config: RuntimeConfig,
  urlPath: string,
  key: string | undefined,
  expParam: string | undefined,
  deepParams?: { d: string; dirs: string; s: string },
): AuthResult {
  if (!key) return FAIL;

  const result = verifyKey(
    config.resolvedKeys,
    urlPath,
    key,
    expParam,
    config.resolvedInsiders,
    deepParams,
  );

  if (result.valid) {
    return {
      valid: true,
      mode: result.mode ?? undefined,
      seed: result.seed ?? undefined,
      keyName: result.keyName,
      matchedPath: result.matchedPath,
      deepShareParams: deepParams,
    };
  }

  return FAIL;
}

/**
 * Resolve auth from a key that might be an insider key (derived from seed).
 * Used when we need to match a provided key against insider seeds directly.
 */
export function resolveInsiderKeyAuth(
  config: RuntimeConfig,
  key: string,
): AuthResult {
  // Check machine keys
  for (const rk of config.resolvedKeys) {
    const insiderKey = computeInsiderKey(rk.seed);
    if (timingSafeEqual(key, insiderKey)) {
      return {
        valid: true,
        mode: 'insider',
        seed: rk.seed,
        scopes: rk.scopes,
        keyName: rk.name,
      };
    }
  }

  // Check insider seeds
  for (const ri of config.resolvedInsiders) {
    if (!ri.seed) continue;
    const insiderKey = computeInsiderKey(ri.seed);
    if (timingSafeEqual(key, insiderKey)) {
      return {
        valid: true,
        mode: 'insider',
        seed: ri.seed,
        scopes: ri.scopes,
        email: ri.email,
        keyName: ri.email,
      };
    }
  }

  return FAIL;
}

/**
 * Resolve auth from a session cookie.
 * Returns insider auth if the session email matches a configured insider with a seed.
 */
export function resolveSessionAuth(
  config: RuntimeConfig,
  request: FastifyRequest,
): AuthResult {
  const { sessionSecret } = config;
  if (!sessionSecret) return FAIL;

  const cookieValue = (request.cookies as Record<string, string> | undefined)?.[
    COOKIE_NAME
  ];
  if (!cookieValue) return FAIL;

  const session = verifySessionCookie(cookieValue, sessionSecret);
  if (!session) return FAIL;

  const insider = config.resolvedInsiders.find(
    (i) => i.email.toLowerCase() === session.email.toLowerCase(),
  );
  if (!insider?.seed) return FAIL;

  return {
    valid: true,
    mode: 'insider',
    seed: insider.seed,
    scopes: insider.scopes,
    email: insider.email,
    keyAge: insider.keyCreatedAt
      ? formatRelativeTime(insider.keyCreatedAt)
      : null,
  };
}

/**
 * Find a resolved insider by email.
 */
export function findInsider(
  insiders: ResolvedInsider[],
  email: string,
): ResolvedInsider | undefined {
  return insiders.find((i) => i.email.toLowerCase() === email.toLowerCase());
}
