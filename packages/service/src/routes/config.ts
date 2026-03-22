/**
 * GET /config — query service configuration with optional JSONPath.
 *
 * Uses the core SDK's `createConfigQueryHandler()` for JSONPath support.
 *
 * @packageDocumentation
 */

import { createConfigQueryHandler } from '@karmaniverous/jeeves';
import type { FastifyInstance } from 'fastify';

import { getConfig } from '../config/index.js';
import type { RuntimeConfig } from '../config/types.js';

/** Return a sanitized copy of the config (redact sensitive fields). */
export function sanitizeConfig(config: RuntimeConfig): unknown {
  return {
    ...config,
    sessionSecret: config.sessionSecret ? '[REDACTED]' : null,
    internalInsiderKey: config.internalInsiderKey ? '[REDACTED]' : null,
    googleAuth: config.googleAuth
      ? {
          clientId: config.googleAuth.clientId,
          clientSecret: '[REDACTED]',
        }
      : null,
    resolvedKeys: config.resolvedKeys.map((k) => ({
      ...k,
      seed: '[REDACTED]',
    })),
    resolvedInsiders: config.resolvedInsiders.map((i) => ({
      ...i,
      seed: '[REDACTED]',
    })),
  };
}

/** Register the GET /config route. */
export function registerConfigRoute(app: FastifyInstance): void {
  const configHandler = createConfigQueryHandler(() =>
    sanitizeConfig(getConfig()),
  );

  app.get('/config', async (request, reply) => {
    const { path } = request.query as { path?: string };
    const result = await configHandler({ path });
    return reply.status(result.status).send(result.body);
  });
}
