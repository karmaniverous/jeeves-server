/**
 * API authentication middleware (preHandler hook): resolves URL keys and
 * session cookies to an access mode, and enforces the authenticated
 * identity's scopes on content routes.
 *
 * @packageDocumentation
 */

import { getUrlKey } from '@karmaniverous/jeeves-server-core';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import {
  type AuthQuery,
  extractDeepParams,
  resolveInsiderKeyAuth,
  resolveKeyAuth,
  resolveSessionAuth,
} from '../../auth/resolve.js';
import { canAccessPath, canNavigatePath } from '../../auth/scopeAccess.js';
import { getConfig } from '../../config/index.js';
import type { NormalizedScopes, RuntimeConfig } from '../../config/types.js';
import {
  type ContentRoute,
  hasTraversalSegment,
  isNavigationRoute,
  keyAuthPath,
  parseContentRoute,
} from './contentRoute.js';
import { OUT_OF_SCOPE_ERROR } from './scopeGuard.js';

/**
 * API routes that authenticate themselves or are public. An entry ending in
 * `/` matches everything below it; any other entry matches that exact path
 * or its sub-paths, never a longer name sharing the prefix.
 */
const UNAUTHENTICATED_PREFIXES = [
  '/api/readme-link',
  '/api/content-link/',
  '/api/auth/status',
  '/api/auth/magic',
  '/api/public-content/',
  '/api/diagram/',
];

/** True when the request path is public or self-authenticating. */
export function isUnauthenticatedApiPath(url: string): boolean {
  const pathname = url.split('?')[0];
  return UNAUTHENTICATED_PREFIXES.some((prefix) =>
    prefix.endsWith('/')
      ? pathname.startsWith(prefix)
      : pathname === prefix || pathname.startsWith(prefix + '/'),
  );
}

/**
 * True when `scopes` permit the request addressed by `route`. Navigation
 * routes admit ancestors of in-scope paths; other content routes require the
 * path itself. Non-content routes (`null`) are scoped by their handlers.
 */
export function scopesAllowRoute(
  route: ContentRoute | null,
  scopes: NormalizedScopes | null | undefined,
): boolean {
  if (!route) return true;
  return isNavigationRoute(route)
    ? canNavigatePath(route.path, scopes)
    : canAccessPath(route.path, scopes);
}

/**
 * Authenticate `/api/util/*`: insider keys or session only. Utility
 * endpoints address paths in their bodies and check scopes themselves.
 */
function authenticateUtility(
  config: RuntimeConfig,
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  const { exp } = request.query as { exp?: string };
  const key = getUrlKey(request.query);

  if (key) {
    const keyResult = resolveKeyAuth(config, '/', key, exp);
    if (keyResult.valid && keyResult.mode === 'insider') {
      request.accessMode = 'insider';
      request.authSeed = keyResult.seed;
      request.insiderScopes = keyResult.scopes ?? null;
      return;
    }

    const insiderResult = resolveInsiderKeyAuth(config, key);
    if (insiderResult.valid) {
      request.accessMode = 'insider';
      request.authSeed = insiderResult.seed;
      request.insiderScopes = insiderResult.scopes ?? null;
      request.insiderEmail = insiderResult.email;
      return;
    }
  }

  const sessionResult = resolveSessionAuth(config, request);
  if (sessionResult.valid) {
    request.accessMode = 'insider';
    request.authSeed = sessionResult.seed;
    request.insiderScopes = sessionResult.scopes ?? null;
    request.insiderEmail = sessionResult.email;
    return;
  }

  void reply
    .code(401)
    .send({ error: 'Insider auth required for utility endpoints' });
}

/**
 * Verify the URL key for exactly `urlPath`. Deep share keys are bound to
 * one path; entries of a directory reached via a deep link carry their own
 * sub-keys (see `computeEntryLink`), so there is no fallback to another
 * stack entry. Deep share keys never authenticate non-content routes.
 */
function resolveUrlKey(
  config: RuntimeConfig,
  urlPath: string,
  query: AuthQuery,
  contentRoute: ContentRoute | null,
) {
  const deepParams = extractDeepParams(query);
  const result = resolveKeyAuth(
    config,
    urlPath,
    getUrlKey(query),
    query.exp,
    deepParams,
  );
  if (result.valid && deepParams && !contentRoute) return { valid: false };
  return result;
}

/**
 * Add the API auth preHandler hook directly to a Fastify instance.
 * Must be called on the parent context (not via register()) so the hook
 * applies to all sibling and child routes.
 */
export function addAuthMiddleware(fastify: FastifyInstance): void {
  fastify.addHook('preHandler', async (request, reply) => {
    if (!request.url.startsWith('/api')) return;
    if (isUnauthenticatedApiPath(request.url)) return;

    const config = getConfig();

    if (request.url.startsWith('/api/util/')) {
      authenticateUtility(config, request, reply);
      return;
    }

    // Reject `..` segments outright: they can resolve outside the path that
    // scope and key checks evaluate.
    const contentRoute = parseContentRoute(request.url);
    if (contentRoute && hasTraversalSegment(contentRoute.path)) {
      void reply.code(400).send({ error: 'Invalid path' });
      return;
    }

    const urlPath = keyAuthPath(request.url, contentRoute);
    const keyResult = resolveUrlKey(
      config,
      urlPath,
      request.query as AuthQuery,
      contentRoute,
    );

    // Always check the session: insiders visiting outsider links are upgraded
    // to insider access, provided the path is within their own scopes.
    const sessionResult = resolveSessionAuth(config, request);
    if (
      sessionResult.valid &&
      scopesAllowRoute(contentRoute, sessionResult.scopes)
    ) {
      request.accessMode = 'insider';
      request.authSeed = sessionResult.seed;
      request.insiderEmail = sessionResult.email;
      request.insiderScopes = sessionResult.scopes ?? null;
      request.keyAge = sessionResult.keyAge;
      return;
    }

    if (keyResult.valid) {
      request.accessMode = keyResult.mode;
      request.authSeed = keyResult.seed;
      request.insiderScopes = keyResult.scopes ?? null;
      request.deepShareParams = keyResult.deepShareParams;
      request.authMatchedPath = keyResult.matchedPath;
      return;
    }

    if (sessionResult.valid) {
      void reply.code(403).send({ error: OUT_OF_SCOPE_ERROR });
      return;
    }

    void reply.code(401).send({ error: 'Unauthorized' });
  });
}
