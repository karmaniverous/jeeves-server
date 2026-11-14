/**
 * GET /config — query service configuration with optional JSONPath.
 * POST /config/apply — deep-merge a patch into the runtime config file.
 *
 * Uses the core SDK's `createConfigQueryHandler()` for JSONPath support and
 * `createConfigApplyHandler()` for merge/validate/write. The apply handler is
 * bound to the config file the service actually loaded
 * (`getConfig().configPath`, from `--config`); core's derived path
 * (`{configRoot}/jeeves-server/config.json`) generally differs from it, which
 * made partial patches validate against an empty config.
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

/**
 * A config apply result with its `config` redacted like `GET /config`
 * (Decision 11): the running config, reloaded from the file just written,
 * through {@link sanitizeConfig}. Failures pass through.
 *
 * @param result - The apply handler's result.
 * @returns The result to send.
 */
export function redactApplyResult(result: { status: number; body: unknown }): {
  status: number;
  body: unknown;
} {
  const { body } = result;
  if (result.status !== 200 || typeof body !== 'object' || body === null)
    return result;
  if (!('config' in body)) return result;
  return { ...result, body: { ...body, config: sanitizeConfig(getConfig()) } };
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

  app.post('/config/apply', async (request, reply) => {
    // Resolve per request: the runtime path is fixed at startup, but binding
    // lazily keeps route registration independent of config initialization.
    const applyHandler = createConfigApplyHandler(
      serverDescriptor,
      getConfig().configPath,
    );
    const result = redactApplyResult(
      await applyHandler(
        request.body as { patch: Record<string, unknown>; replace?: boolean },
      ),
    );
    return reply.status(result.status).send(result.body);
  });
}
