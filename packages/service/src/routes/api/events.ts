/**
 * GET /api/events — returns recent event log entries.
 *
 * @packageDocumentation
 */

import { type HandlersFor, ok } from '../../api/handlerTypes.js';
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

/**
 * `listEvents`: recent event log entries. An `admin` entry (the access
 * hook admits only identities with no scopes, Decision 12): unmatched
 * webhook bodies are stored in full and belong to no path a scoped caller
 * could be checked against.
 */
export const eventsHandlers: HandlersFor<'listEvents'> = {
  listEvents: ({ query }) =>
    Promise.resolve(
      // Copied to plain objects: the response schema is open (looseObject).
      ok(getRecentEvents(parseEventsLimit(query.limit)).map((e) => ({ ...e }))),
    ),
};
