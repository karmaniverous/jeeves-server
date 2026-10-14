/**
 * GET /api/events — returns recent event log entries.
 */

import type { FastifyPluginAsync } from 'fastify';

import { getRecentEvents } from '../../services/eventLog.js';

export const eventsRoutes: FastifyPluginAsync = (fastify) => {
  fastify.get<{ Querystring: { limit?: string } }>(
    '/api/events',
    (request, reply) => {
      // Only insiders with no scopes configured (strict: any scopes, even
      // allow '/**', refuse). Unmatched webhook bodies are stored in full and
      // belong to no path a scoped insider could be checked against.
      if (request.accessMode !== 'insider' || request.insiderScopes !== null) {
        return reply
          .code(403)
          .send({ error: 'Unscoped insider access required' });
      }
      const limit = Math.min(
        Math.max(parseInt(request.query.limit ?? '20', 10) || 20, 1),
        100,
      );
      return getRecentEvents(limit);
    },
  );

  return Promise.resolve();
};
