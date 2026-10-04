/**
 * API authentication middleware (preHandler hook).
 */

import type { FastifyInstance } from 'fastify';

import {
  type AuthQuery,
  extractDeepParams,
  resolveInsiderKeyAuth,
  resolveKeyAuth,
  resolveSessionAuth,
} from '../../auth/resolve.js';
import {
  hasTraversalSegment,
  parseContentRoute,
  scopesAllowRoute,
} from '../../auth/scopeAccess.js';
import { getConfig } from '../../config/index.js';
import { decodeStack } from '../../services/deepShareLinks.js';

/**
 * Add the API auth preHandler hook directly to a Fastify instance.
 * Must be called on the parent context (not via register()) so the hook
 * applies to all sibling and child routes.
 */
export function addAuthMiddleware(fastify: FastifyInstance): void {
  fastify.addHook('preHandler', async (request, reply) => {
    if (!request.url.startsWith('/api')) return;
    if (request.url.startsWith('/api/readme-link')) return;
    if (request.url.startsWith('/api/content-link/')) return;
    if (request.url.startsWith('/api/auth/status')) return;
    if (request.url.startsWith('/api/auth/magic')) return;
    if (request.url.startsWith('/api/public-content/')) return;
    if (request.url.startsWith('/api/diagram/')) return;
    if (request.url.startsWith('/api/status')) return;
    if (request.url.startsWith('/api/resolve-path')) return;

    const config = getConfig();

    // Utility endpoints handle their own scope checking
    if (request.url.startsWith('/api/util/')) {
      const query = request.query as { key?: string; exp?: string };

      // Try key-based auth
      if (query.key) {
        const keyResult = resolveKeyAuth(config, '/', query.key, query.exp);
        if (keyResult.valid && keyResult.mode === 'insider') {
          request.accessMode = 'insider';
          request.authSeed = keyResult.seed;
          request.insiderScopes = keyResult.scopes ?? null;
          return;
        }

        // Try as a direct insider key
        const insiderResult = resolveInsiderKeyAuth(config, query.key);
        if (insiderResult.valid) {
          request.accessMode = 'insider';
          request.authSeed = insiderResult.seed;
          request.insiderScopes = insiderResult.scopes ?? null;
          request.insiderEmail = insiderResult.email;
          return;
        }
      }

      // Try session cookie
      const sessionResult = resolveSessionAuth(config, request);
      if (sessionResult.valid) {
        request.accessMode = 'insider';
        request.authSeed = sessionResult.seed;
        request.insiderScopes = sessionResult.scopes ?? null;
        request.insiderEmail = sessionResult.email;
        return;
      }

      reply
        .code(401)
        .send({ error: 'Insider auth required for utility endpoints' });
      return;
    }

    // General API auth
    const query = request.query as AuthQuery;
    const deepParams = extractDeepParams(query);

    // Content path addressed by this request (null for non-content routes).
    // Reject `..` segments outright: they can resolve outside the path that
    // scope and key checks evaluate.
    const contentRoute = parseContentRoute(request.url);
    if (contentRoute && hasTraversalSegment(contentRoute.path)) {
      reply.code(400).send({ error: 'Invalid path' });
      return;
    }

    let urlPath: string;
    try {
      urlPath = decodeURIComponent(
        request.url
          .split('?')[0]
          .replace('/api/path', '')
          .replace('/api/drives', '/')
          .replace('/api/file', '')
          .replace('/api/raw', '')
          .replace('/api/export-cache', '')
          .replace('/api/export', ''),
      );
    } catch {
      // Malformed percent-encoding — use the raw path
      urlPath = request.url
        .split('?')[0]
        .replace('/api/path', '')
        .replace('/api/drives', '/')
        .replace('/api/file', '')
        .replace('/api/raw', '')
        .replace('/api/export-cache', '')
        .replace('/api/export', '');
    }

    // Try key-based auth
    let authResult = resolveKeyAuth(
      config,
      urlPath || '/',
      query.key,
      query.exp,
      deepParams,
    );

    // Retry with dirs fallback (directory shares)
    if (
      !authResult.valid &&
      deepParams &&
      deepParams.dirs === '1' &&
      query.key
    ) {
      const stack = decodeStack(deepParams.s);
      const lastStackEntry = stack[stack.length - 1];
      if (lastStackEntry && lastStackEntry !== urlPath) {
        authResult = resolveKeyAuth(
          config,
          lastStackEntry,
          query.key,
          query.exp,
          deepParams,
        );
      }
    }

    // Try session cookie (always check — insiders visiting outsider links
    // should be upgraded to insider access)
    const sessionResult = resolveSessionAuth(config, request);
    const sessionInScope =
      sessionResult.valid &&
      scopesAllowRoute(contentRoute, sessionResult.scopes ?? null);

    if (authResult.valid && sessionInScope) {
      // Both key and session are valid — prefer insider session
      request.accessMode = 'insider';
      request.authSeed = sessionResult.seed;
      request.insiderEmail = sessionResult.email;
      request.insiderScopes = sessionResult.scopes ?? null;
      request.keyAge = sessionResult.keyAge;
      return;
    }

    if (authResult.valid) {
      request.accessMode = authResult.mode;
      request.authSeed = authResult.seed;
      request.deepShareParams = authResult.deepShareParams;
      request.authMatchedPath = authResult.matchedPath;
      return;
    }

    if (sessionInScope) {
      request.accessMode = 'insider';
      request.authSeed = sessionResult.seed;
      request.insiderEmail = sessionResult.email;
      request.insiderScopes = sessionResult.scopes ?? null;
      request.keyAge = sessionResult.keyAge;
      return;
    }

    if (sessionResult.valid) {
      reply.code(403).send({ error: 'Path is outside your access scope' });
      return;
    }

    reply.code(401).send({ error: 'Unauthorized' });
    return;
  });
}
