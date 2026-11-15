/**
 * `server_event_status` on the SDK: the configured event schemas (`status`) and the recent event log (`listEvents`), in the 0.15.0 result shape.
 *
 * @packageDocumentation
 */

import type { ToolDescriptor } from '@karmaniverous/jeeves';

import { runServerCall, type ToolContext } from './sdkCall.js';

/** Recent events returned when `limit` is omitted. */
const DEFAULT_EVENT_LIMIT = 20;

/**
 * Build `server_event_status`.
 *
 * @param context - Plugin API and public URL.
 * @returns The tool.
 */
export function createEventStatusTool(context: ToolContext): ToolDescriptor {
  return {
    name: 'server_event_status',
    description:
      'Query event gateway status: active schemas, recent event log entries, and event counts.',
    parameters: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description:
            'Maximum number of recent events to return (default: 20)',
        },
      },
    },
    execute: (_id, params) =>
      runServerCall(context, async (client) => {
        const limit = params.limit ? Number(params.limit) : DEFAULT_EVENT_LIMIT;
        const [status, recent] = await Promise.all([
          client.status(),
          client.listEvents({ limit: String(limit) }),
        ]);
        const events = (status as { health?: { events?: unknown } }).health
          ?.events;
        const activeSchemas = Array.isArray(events) ? events : [];
        return {
          activeSchemas,
          schemaCount: activeSchemas.length,
          recentEvents: recent,
          recentCount: recent.length,
        };
      }),
  };
}
