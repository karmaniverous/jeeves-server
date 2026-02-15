/**
 * Event Gateway webhook endpoint
 */

import { JsonMap } from '@karmaniverous/jsonmap';
import Ajv from 'ajv';
import type { FastifyPluginAsync } from 'fastify';
import * as _ from 'lodash-es';

import { verifyKey } from '../auth/keys.js';
import { getConfig } from '../config/index.js';
import { logEvent } from '../services/eventLog.js';
import { enqueue } from '../services/eventQueue.js';

const ajv = new Ajv();

interface EventRequest {
  Body: Record<string, unknown>;
  Querystring: { key?: string };
}

/**
 * Match request body against configured event schemas
 */
function matchEvent(
  body: Record<string, unknown>,
): { name: string; cmd: string; map?: object; timeoutMs: number } | null {
  const { events, eventTimeoutMs } = getConfig();

  for (const [name, eventConfig] of Object.entries(events)) {
    const validate = ajv.compile(eventConfig.schema);

    if (validate(body)) {
      return {
        name,
        cmd: eventConfig.cmd,
        map: eventConfig.map,
        timeoutMs: eventConfig.timeoutMs ?? eventTimeoutMs,
      };
    }
  }

  return null;
}

/**
 * Transform body using JsonMap (if map is defined)
 */
async function transformBody(
  body: Record<string, unknown>,
  map?: object,
): Promise<Record<string, unknown>> {
  if (!map) return body;

  // JsonMap with lodash available as $.lib._
  const mapper = new JsonMap(map, { _: _ as never });
  const result = await mapper.transform(body);
  return result as Record<string, unknown>;
}

// eslint-disable-next-line @typescript-eslint/require-await
export const eventRoute: FastifyPluginAsync = async (fastify) => {
  // Auth middleware
  fastify.addHook('preHandler', async (request, reply) => {
    if (!request.url.startsWith('/event')) return;

    const provided = (request.query as { key?: string }).key;
    const config = getConfig();

    const result = verifyKey(
      config.resolvedKeys,
      '/event',
      provided,
      undefined,
    );

    if (!result.valid) {
      reply.code(401).send({ error: 'Unauthorized' });
    }
  });

  // Event endpoint
  fastify.post<EventRequest>('/event', async (request) => {
    const body = request.body;

    // Match against configured events
    const match = matchEvent(body);

    if (match) {
      // Transform body if map is defined
      const transformedBody = await transformBody(body, match.map);

      // Enqueue for processing
      enqueue(match.name, match.cmd, transformedBody, match.timeoutMs);

      return { matched: match.name };
    } else {
      // Log unmatched event
      logEvent({
        event: null,
        matched: false,
        bodyPreview: JSON.stringify(body),
      });

      // Always return 200 for unmatched events (prevents webhook retry/disable)
      return { matched: null };
    }
  });
};
