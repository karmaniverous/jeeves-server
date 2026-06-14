/**
 * GET /config — query service configuration with optional JSONPath.
 *
 * Uses the core SDK's `createConfigQueryHandler()` for JSONPath support.
 *
 * @packageDocumentation
 */

import {
  createConfigApplyHandler,
  createConfigQueryHandler,
} from '@karmaniverous/jeeves';
import type { FastifyInstance } from 'fastify';

import { getConfig } from '../config/index.js';
import type { RuntimeConfig } from '../config/types.js';
import { serverDescriptor } from '../descriptor.js';

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
    emailAuth: config.emailAuth
      ? {
          smtpUrl: '[REDACTED]',
          fromAddress: config.emailAuth.fromAddress,
        }
      : null,
  };
}

/** Register the GET /config and POST /config/apply routes. */
export function registerConfigRoute(app: FastifyInstance): void {
  const configHandler = createConfigQueryHandler(() =>
    sanitizeConfig(getConfig()),
  );

  app.get('/config', async (request, reply) => {
    const { path } = request.query as { path?: string };
    const result = await configHandler({ path });
    return reply.status(result.status).send(result.body);
  });

  const applyHandler = createConfigApplyHandler(serverDescriptor);

  app.post('/config/apply', async (request, reply) => {
    const result = await applyHandler(
      request.body as { patch: Record<string, unknown>; replace?: boolean },
    );
    return reply.status(result.status).send(result.body);
  });
}
