/**
 * Event Gateway webhook endpoint
 */

import {
  type Json,
  JsonMap,
  type JsonMapLib,
  type JsonMapMap,
} from '@karmaniverous/jsonmap';
import Ajv from 'ajv';
import * as _ from 'radash';

import { type HandlersFor, ok } from '../api/handlerTypes.js';
import { getConfig } from '../config/index.js';
import { logEvent } from '../services/eventLog.js';
import { enqueue } from '../services/eventQueue.js';
import { storedBody } from '../util/eventBody.js';

const ajv = new Ajv();

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

/**
 * `receiveEvent` (`POST /event`, `eventKey`: the access hook verifies the
 * key). The body is a JSON object (an array or scalar is a 400, Decision
 * 14; a missing body is `{}`). A match is transformed and queued; an
 * unmatched body is logged (capped) and still answered 200, so webhooks
 * aren't retried or disabled.
 */
export const eventHandlers: HandlersFor<'receiveEvent'> = {
  receiveEvent: async ({ body }) => {
    const match = matchEvent(body);
    if (match) {
      const transformedBody = await transformBody(body, match.map);
      await enqueue(match.name, match.cmd, transformedBody, match.timeoutMs);
      return ok({ matched: match.name });
    }
    // Full bodies are kept (they're used to design new event schemas),
    // capped per entry.
    logEvent({
      event: null,
      matched: false,
      ...storedBody(JSON.stringify(body)),
    });
    return ok({ matched: null });
  },
};
