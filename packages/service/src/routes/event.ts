/**
 * Event Gateway webhook endpoint
 */

import { getUrlKey } from '@karmaniverous/jeeves-server-core';
import {
  type Json,
  JsonMap,
  type JsonMapLib,
  type JsonMapMap,
} from '@karmaniverous/jsonmap';
import Ajv from 'ajv';
import type { FastifyPluginCallback } from 'fastify';
import * as _ from 'radash';

import { Unauthorized } from '../api/errors.js';
import { verifyKey } from '../auth/keys.js';
import { getConfig } from '../config/index.js';
import { logEvent } from '../services/eventLog.js';
import { enqueue } from '../services/eventQueue.js';
import { storedBody } from '../util/eventBody.js';

const ajv = new Ajv();

interface EventRequest {
  Body: Record<string, unknown>;
  Querystring: { k?: string; key?: string };
}

/**
 * Match request body against configured event schemas
 */
function matchEvent(
  body: Record<string, unknown>,
): { name: string; cmd: string; map?: JsonMapMap; timeoutMs: number } | null {
  const { events, eventTimeoutMs } = getConfig();

  for (const [name, eventConfig] of Object.entries(events)) {
    const validate = ajv.compile(eventConfig.schema);

    if (validate(body)) {
      return {
        name,
        cmd: eventConfig.cmd,
        map: eventConfig.map as JsonMapMap | undefined,
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
  map?: JsonMapMap,
): Promise<Record<string, unknown>> {
  if (!map) return body;

  // JsonMap with radash available as $.lib._
  const mapper = new JsonMap(map, { _: _ as unknown as JsonMapLib });
  const result = await mapper.transform(body as unknown as Json);
  return result as Record<string, unknown>;
}

export const eventRoute: FastifyPluginCallback = (fastify, _opts, done) => {
  // Auth middleware
  fastify.addHook('preHandler', (request, _reply, hookDone) => {
    if (request.url.startsWith('/event')) {
      const result = verifyKey(
        getConfig().resolvedKeys,
        '/event',
        getUrlKey(request.query),
        undefined,
      );
      if (!result.valid) throw new Unauthorized('Unauthorized');
    }
    hookDone();
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
      // Full bodies are kept (they're used to design new event schemas),
      // capped per entry.
      logEvent({
        event: null,
        matched: false,
        ...storedBody(JSON.stringify(body)),
      });

      // Always return 200 for unmatched events (prevents webhook retry/disable)
      return { matched: null };
    }
  });
  done();
};
