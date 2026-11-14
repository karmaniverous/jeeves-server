/**
 * The redaction of `GET /config` and of the `POST /config/apply` response (Decision 11): secrets replaced with `[REDACTED]`. The routes themselves are jeeves' standard handlers (`standard.ts`); config apply is bound to the file the service loaded (`getConfig().configPath`, from `--config`).
 *
 * @packageDocumentation
 */

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
