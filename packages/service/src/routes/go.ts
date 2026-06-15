/**
 * Shortlink redirect route.
 *
 * `GET /go/:slug` — redirects to a configured target URL or path.
 * No authentication required; targets handle their own auth.
 *
 * @packageDocumentation
 */

import type { FastifyPluginCallback } from 'fastify';

import { getConfig } from '../config/index.js';

export const goRoute: FastifyPluginCallback = (fastify, _opts, done) => {
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
  done();
};
