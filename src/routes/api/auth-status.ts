/**
 * Auth status API route.
 *
 * Handles: /api/auth/status
 */

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';

import { verifyKey } from '../../auth/keys.js';
import { COOKIE_NAME, verifySessionCookie } from '../../auth/session.js';
import { getConfig } from '../../config/index.js';

// eslint-disable-next-line @typescript-eslint/require-await
export const authStatusRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/auth/status', async (request: FastifyRequest, reply: FastifyReply) => {
    const config = getConfig();
    const sessionSecret = config.sessionSecret;

    if (sessionSecret) {
      const cookieValue = (request.cookies as Record<string, string> | undefined)?.[COOKIE_NAME];
      if (cookieValue) {
        const session = verifySessionCookie(cookieValue, sessionSecret);
        if (session) {
          const insider = config.resolvedInsiders.find(
            (i) => i.email.toLowerCase() === session.email.toLowerCase(),
          );
          return reply.send({
            authenticated: true,
            email: session.email,
            picture: session.picture,
            isInsider: !!insider?.seed,
            keyCreatedAt: insider?.keyCreatedAt ?? null,
          });
        }
      }
    }

    if (config.authModes.includes('keys')) {
      const query = request.query as Record<string, string>;
      const providedKey = query.key;
      if (providedKey) {
        const verifyPath = query.path ?? '/';
        const deepParams = query.d !== undefined && query.s !== undefined
          ? { d: query.d, dirs: query.dirs ?? '0', s: query.s }
          : undefined;
        const result = verifyKey(config.resolvedKeys, verifyPath, providedKey, query.exp, config.resolvedInsiders, deepParams);
        if (result.valid) {
          return reply.send({
            authenticated: true,
            email: `key:${result.keyName}`,
            isInsider: result.mode === 'insider',
            keyCreatedAt: null,
          });
        }
      }
    }

    return reply.send({ authenticated: false, isInsider: false });
  });
};
