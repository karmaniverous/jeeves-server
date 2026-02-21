/**
 * API authentication middleware (preHandler hook).
 */

import type { FastifyPluginAsync } from 'fastify';

import {
  _pathMatchesScopes,
  verifyKey,
} from '../../auth/keys.js';
import { computeInsiderKey, timingSafeEqual } from '../../util/crypto.js';
import { COOKIE_NAME, verifySessionCookie } from '../../auth/session.js';
import { getConfig } from '../../config/index.js';
import { formatRelativeTime } from '../../util/formatters.js';
import { decodeStack } from '../../services/deepShareLinks.js';

// eslint-disable-next-line @typescript-eslint/require-await
export const authMiddleware: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', async (request, reply) => {
    if (!request.url.startsWith('/api')) return;
    if (request.url.startsWith('/api/readme-link')) return;
    if (request.url.startsWith('/api/auth/status')) return;
    if (request.url.startsWith('/api/diagram/')) return;

    // Utility endpoints handle their own scope checking
    if (request.url.startsWith('/api/util/')) {
      const config = getConfig();
      const query = request.query as { key?: string; exp?: string };
      const provided = query.key;

      if (provided) {
        const result = verifyKey(config.resolvedKeys, '/', provided, query.exp, config.resolvedInsiders);
        if (result.valid && result.mode === 'insider') {
          request.accessMode = 'insider';
          request.authSeed = result.seed!;
          request.insiderScopes =
            config.resolvedKeys.find(k => k.seed === result.seed)?.scopes ?? null;
          return;
        }
        for (const ri of config.resolvedInsiders) {
          if (!ri.seed) continue;
          const insiderKey = computeInsiderKey(ri.seed);
          if (timingSafeEqual(provided, insiderKey)) {
            request.accessMode = 'insider';
            request.authSeed = ri.seed;
            request.insiderScopes = ri.scopes;
            request.insiderEmail = ri.email;
            return;
          }
        }
      }

      const sessionSecret = config.sessionSecret;
      if (sessionSecret) {
        const cookieValue = (request.cookies as Record<string, string> | undefined)?.[COOKIE_NAME];
        if (cookieValue) {
          const session = verifySessionCookie(cookieValue, sessionSecret);
          if (session) {
            const insider = config.resolvedInsiders.find(
              (i) => i.email.toLowerCase() === session.email.toLowerCase(),
            );
            if (insider?.seed) {
              request.accessMode = 'insider';
              request.authSeed = insider.seed;
              request.insiderScopes = insider.scopes;
              request.insiderEmail = insider.email;
              return;
            }
          }
        }
      }

      reply.code(401).send({ error: 'Insider auth required for utility endpoints' });
      return;
    }

    const config = getConfig();
    const query = request.query as { key?: string; exp?: string; d?: string; dirs?: string; s?: string };
    const provided = query.key;
    const expParam = query.exp;
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

    let authResult = verifyKey(
      config.resolvedKeys,
      urlPath || '/',
      provided,
      expParam,
      config.resolvedInsiders,
      deepParams,
    );

    if (!authResult.valid && deepParams && deepParams.dirs === '1' && provided) {
      const stack = decodeStack(deepParams.s);
      const lastStackEntry = stack[stack.length - 1];
      if (lastStackEntry && lastStackEntry !== urlPath) {
        authResult = verifyKey(
          config.resolvedKeys,
          lastStackEntry,
          provided,
          expParam,
          config.resolvedInsiders,
          deepParams,
        );
      }
    }

    if (authResult.valid) {
      request.accessMode = authResult.mode ?? undefined;
      request.authSeed = authResult.seed ?? undefined;
      request.deepShareParams = deepParams;
      request.authMatchedPath = authResult.matchedPath;
      return;
    }

    const sessionSecret = config.sessionSecret;
    if (sessionSecret) {
      const cookieValue = (
        request.cookies as Record<string, string> | undefined
      )?.[COOKIE_NAME];
      if (cookieValue) {
        const session = verifySessionCookie(cookieValue, sessionSecret);
        if (session) {
          const insider = config.resolvedInsiders.find(
            (i) => i.email.toLowerCase() === session.email.toLowerCase(),
          );
          if (insider?.seed) {
            request.accessMode = 'insider';
            request.authSeed = insider.seed;
            request.insiderEmail = insider.email;
            request.insiderScopes = insider.scopes ?? null;
            request.keyAge = insider.keyCreatedAt
              ? formatRelativeTime(insider.keyCreatedAt)
              : null;
            return;
          }
        }
      }
    }

    reply.code(401).send({ error: 'Unauthorized' });
    return;
  });
};
