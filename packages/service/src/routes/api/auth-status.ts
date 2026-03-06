/**
 * Auth status API route.
 *
 * Handles: /api/auth/status
 */

import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';

import {
  findInsider,
  resolveKeyAuth,
  resolveSessionAuth,
} from '../../auth/resolve.js';
import { getConfig } from '../../config/index.js';

// eslint-disable-next-line @typescript-eslint/require-await
export const authStatusRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/auth/status',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const config = getConfig();

      // Try session cookie first
      const sessionResult = resolveSessionAuth(config, request);
      if (sessionResult.valid) {
        const insider = findInsider(
          config.resolvedInsiders,
          sessionResult.email!,
        );
        // Get picture from session cookie directly
        const cookieValue = (
          request.cookies as Record<string, string> | undefined
        )?.['jeeves_session'];
        let picture: string | undefined;
        if (cookieValue) {
          try {
            const b64 = cookieValue.slice(0, cookieValue.lastIndexOf('.'));
            const payload = JSON.parse(
              Buffer.from(b64, 'base64url').toString(),
            ) as { picture?: string };
            picture = payload.picture;
          } catch {
            /* ignore */
          }
        }

        return reply.send({
          authenticated: true,
          email: sessionResult.email,
          picture,
          isInsider: !!insider?.seed,
          keyCreatedAt: insider?.keyCreatedAt ?? null,
          searchEnabled: !!config.watcherUrl,
        });
      }

      // Try key-based auth
      if (config.authModes.includes('keys')) {
        const query = request.query as Record<string, string | undefined>;
        const deepParams =
          query.d !== undefined && query.s !== undefined
            ? { d: query.d, dirs: query.dirs ?? '0', s: query.s }
            : undefined;

        const keyResult = resolveKeyAuth(
          config,
          query.path ?? '/',
          query.key,
          query.exp,
          deepParams,
        );
        if (keyResult.valid) {
          return reply.send({
            authenticated: true,
            email: `key:${String(keyResult.keyName)}`,
            isInsider: keyResult.mode === 'insider',
            keyCreatedAt: null,
          });
        }
      }

      return reply.send({ authenticated: false, isInsider: false });
    },
  );
};
