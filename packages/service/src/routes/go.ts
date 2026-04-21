/**
 * Shortlink redirect route.
 *
 * `GET /go/:slug` — redirects to a configured target URL or path.
 * No authentication required; targets handle their own auth.
 *
 * @packageDocumentation
 */

import type { FastifyPluginAsync } from 'fastify';

import { getConfig } from '../config/index.js';

// eslint-disable-next-line @typescript-eslint/require-await
export const goRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: { slug: string } }>(
    '/go/:slug',
    async (request, reply) => {
      const { slug } = request.params;
      const config = getConfig();
      const target = config.go[slug];

      if (typeof target !== 'string') {
        return reply.code(404).send({ error: 'Unknown shortlink' });
      }

      return reply.redirect(target, 302);
    },
  );
};
