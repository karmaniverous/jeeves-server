/**
 * The event entries of the server catalog: the webhook receiver (`receiveEvent`, any JSON object; Decision 14) and the event log (`listEvents`). Pure.
 *
 * @packageDocumentation
 */

import { z } from 'zod';

import { EVENT_KEY, INSIDER_ONLY, route } from './route.js';

/** `receiveEvent` response. */
export const receiveEventResponseSchema = z.object({
  /** Name of the event that matched, or null (the body is logged). */
  matched: z.string().nullable(),
});

/** One event log entry. Entries written by other versions keep their fields. */
export const eventLogEntrySchema = z.looseObject({
  /** When it was logged (ISO). */
  ts: z.string(),
  /** Matched event name, or null for an unmatched body. */
  event: z.string().nullable(),
  /** Whether the body matched an event. */
  matched: z.boolean(),
  /** Exit code of the event command. */
  exitCode: z.number().optional(),
  /** Command duration. */
  durationMs: z.number().optional(),
  /** Unmatched body as JSON, capped at 256 KiB. */
  bodyPreview: z.string().optional(),
  /** True when `bodyPreview` was cut at the cap. */
  truncated: z.boolean().optional(),
  /** UTF-8 byte length of the full body, when truncated. */
  originalBytes: z.number().optional(),
});

/** The event entries. */
export const EVENT_ENTRIES = [
  {
    ...route('receiveEvent', 'POST', '/event'),
    body: z.looseObject({}),
    response: receiveEventResponseSchema,
    auth: EVENT_KEY,
    kind: 'write',
  },
  {
    ...route('listEvents', 'GET', '/api/events'),
    query: z.object({
      // A string, as today: a value that isn't a number gives the default.
      limit: z
        .string()
        .optional()
        .describe('Entries to return (default 20, at most 100).'),
    }),
    response: z.array(eventLogEntrySchema),
    auth: INSIDER_ONLY,
    kind: 'read',
  },
] as const;
