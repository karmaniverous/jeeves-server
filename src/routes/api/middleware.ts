/**
 * API authentication middleware (preHandler hook).
 */

import type { FastifyPluginAsync } from 'fastify';

import { resolveKeyAuth, resolveInsiderKeyAuth, resolveSessionAuth } from '../../auth/resolve.js';
import { getConfig } from '../../config/index.js';
import { decodeStack } from '../../services/deepShareLinks.js';
import { verifyKey } from '../../auth/keys.js';

// eslint-disable-next-line @typescript-eslint/require-await
export const authMiddleware: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', async (request, reply) => {
    if (!request.url.startsWith('/api')) return;
    if (request.url.startsWith('/api/readme-link')) return;
    if (request.url.startsWith('/api/auth/status')) return;
    if (request.url.startsWith('/api/diagram/')) return;

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

      reply.code(401).send({ error: 'Insider auth required for utility endpoints' });
      return;
    }

    // General API auth
    const query = request.query as { key?: string; exp?: string; d?: string; dirs?: string; s?: string };
    const deepParams = query.d !== undefined && query.s !== undefined
      ? { d: query.d!, dirs: query.dirs ?? '0', s: query.s! }
      : undefined;

    const urlPath = request.url
      .split('?')[0]
      .replace('/api/path', '')
      .replace('/api/drives', '/')
      .replace('/api/file', '')
      .replace('/api/raw', '')
      .replace('/api/export', '');

    // Try key-based auth
    let authResult = resolveKeyAuth(config, urlPath || '/', query.key, query.exp, deepParams);

    // Retry with dirs fallback (directory shares)
    if (!authResult.valid && deepParams && deepParams.dirs === '1' && query.key) {
      const stack = decodeStack(deepParams.s);
      const lastStackEntry = stack[stack.length - 1];
      if (lastStackEntry && lastStackEntry !== urlPath) {
        authResult = resolveKeyAuth(config, lastStackEntry, query.key, query.exp, deepParams);
      }
    }

    if (authResult.valid) {
      request.accessMode = authResult.mode;
      request.authSeed = authResult.seed;
      request.deepShareParams = authResult.deepShareParams;
      request.authMatchedPath = authResult.matchedPath;
      return;
    }

    // Try session cookie
    const sessionResult = resolveSessionAuth(config, request);
    if (sessionResult.valid) {
      request.accessMode = 'insider';
      request.authSeed = sessionResult.seed;
      request.insiderEmail = sessionResult.email;
      request.insiderScopes = sessionResult.scopes ?? null;
      request.keyAge = sessionResult.keyAge;
      return;
    }

    reply.code(401).send({ error: 'Unauthorized' });
    return;
  });
};
