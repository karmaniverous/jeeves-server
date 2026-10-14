/**
 * GET /api/events — returns recent event log entries.
 */

import type { FastifyPluginAsync } from 'fastify';

import { getRecentEvents } from '../../services/eventLog.js';

export const eventsRoutes: FastifyPluginAsync = (fastify) => {
  fastify.get<{ Querystring: { limit?: string } }>(
    '/api/events',
    (request, reply) => {
      // Insider only: unmatched webhook bodies are stored in full.
      if (request.accessMode !== 'insider') {
        return reply.code(403).send({ error: 'Insider access required' });
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
