/**
 * API authentication middleware (preHandler hook): resolves URL keys and
 * session cookies to an access mode, and enforces the authenticated
 * identity's scopes on content routes.
 *
 * @packageDocumentation
 */

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
import { decodeStack } from '../../services/deepShareLinks.js';
import {
  type ContentRoute,
  hasTraversalSegment,
  isNavigationRoute,
  keyAuthPath,
  parseContentRoute,
} from './contentRoute.js';
import { OUT_OF_SCOPE_ERROR } from './scopeGuard.js';

/** API prefixes that authenticate themselves or are public. */
const UNAUTHENTICATED_PREFIXES = [
  '/api/readme-link',
  '/api/content-link/',
  '/api/auth/status',
  '/api/auth/magic',
  '/api/public-content/',
  '/api/diagram/',
  '/api/status',
  '/api/resolve-path',
];

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
  const { key, exp } = request.query as { key?: string; exp?: string };

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
 * Verify the URL key for `urlPath`, retrying against the last deep-share
 * stack entry for directory shares (`dirs=1`).
 */
function resolveUrlKey(
  config: RuntimeConfig,
  urlPath: string,
  query: AuthQuery,
) {
  const deepParams = extractDeepParams(query);
  const result = resolveKeyAuth(
    config,
    urlPath,
    query.key,
    query.exp,
    deepParams,
  );
  if (result.valid || deepParams?.dirs !== '1' || !query.key) return result;

  const stack = decodeStack(deepParams.s);
  const lastStackEntry = stack[stack.length - 1];
  if (!lastStackEntry || lastStackEntry === urlPath) return result;
  return resolveKeyAuth(
    config,
    lastStackEntry,
    query.key,
    query.exp,
    deepParams,
  );
}

/**
 * Add the API auth preHandler hook directly to a Fastify instance.
 * Must be called on the parent context (not via register()) so the hook
 * applies to all sibling and child routes.
 */
export function addAuthMiddleware(fastify: FastifyInstance): void {
  fastify.addHook('preHandler', async (request, reply) => {
    if (!request.url.startsWith('/api')) return;
    if (UNAUTHENTICATED_PREFIXES.some((p) => request.url.startsWith(p))) return;

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
