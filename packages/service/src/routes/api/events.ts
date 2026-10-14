/**
 * GET /api/events — returns recent event log entries.
 */

import type { FastifyPluginAsync } from 'fastify';

import { getRecentEvents } from '../../services/eventLog.js';

/** Entries returned when `limit` is missing or not a number. */
export const DEFAULT_EVENTS_LIMIT = 20;

/** Upper bound on `limit`. */
export const MAX_EVENTS_LIMIT = 100;

/** Error for callers other than insiders with no scopes configured (403). */
export const UNSCOPED_INSIDER_REQUIRED_ERROR =
  'Unscoped insider access required';

/** Parse `limit`: default when absent or not a number, clamped to 1–max. */
function parseEventsLimit(raw: string | undefined): number {
  const requested =
    parseInt(raw ?? String(DEFAULT_EVENTS_LIMIT), 10) || DEFAULT_EVENTS_LIMIT;
  return Math.min(Math.max(requested, 1), MAX_EVENTS_LIMIT);
}

export const eventsRoutes: FastifyPluginAsync = (fastify) => {
  fastify.get<{ Querystring: { limit?: string } }>(
    '/api/events',
    (request, reply) => {
      // Only insiders with no scopes configured (strict: any scopes, even
      // allow '/**', refuse). Unmatched webhook bodies are stored in full and
      // belong to no path a scoped insider could be checked against.
      if (request.accessMode !== 'insider' || request.insiderScopes !== null) {
        return reply.code(403).send({ error: UNSCOPED_INSIDER_REQUIRED_ERROR });
      }
      return getRecentEvents(parseEventsLimit(request.query.limit));
    },
  );

  return Promise.resolve();
};
