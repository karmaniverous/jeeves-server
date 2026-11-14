/**
 * GET /api/events — returns recent event log entries.
 */

import type { FastifyPluginAsync } from 'fastify';

import { getRecentEvents } from '../../services/eventLog.js';

/** Entries returned when `limit` is missing or not a number. */
export const DEFAULT_EVENTS_LIMIT = 20;

/** Upper bound on `limit`. */
export const MAX_EVENTS_LIMIT = 100;

/** Parse `limit`: default when absent or not a number, clamped to 1–max. */
function parseEventsLimit(raw: string | undefined): number {
  const requested =
    parseInt(raw ?? String(DEFAULT_EVENTS_LIMIT), 10) || DEFAULT_EVENTS_LIMIT;
  return Math.min(Math.max(requested, 1), MAX_EVENTS_LIMIT);
}

export const eventsRoutes: FastifyPluginAsync = (fastify) => {
  // An `admin` entry (the access hook admits only identities with no scopes,
  // Decision 12): unmatched webhook bodies are stored in full and belong to
  // no path a scoped caller could be checked against.
  fastify.get<{ Querystring: { limit?: string } }>('/api/events', (request) =>
    getRecentEvents(parseEventsLimit(request.query.limit)),
  );

  return Promise.resolve();
};
