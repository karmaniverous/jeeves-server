/**
 * Handlers of jeeves' three standard entries (`status`, `config`, `configApply`), from core's handler factories through `standardHandlers`: `status` adds the sign-in redirect URIs and hides the admin-only details from callers that aren't admin (Decision 22); `config` and its apply response are redacted (Decision 11).
 *
 * @packageDocumentation
 */

import {
  createConfigApplyHandler,
  createConfigQueryHandler,
} from '@karmaniverous/jeeves';
import { standardHandlers } from '@karmaniverous/jeeves/fastify';
import type { ServerResponse } from '@karmaniverous/jeeves-server-core';

import { type HandlersFor, ok } from '../api/handlerTypes.js';
import { getConfig } from '../config/index.js';
import { serverDescriptor } from '../descriptor.js';
import { redactApplyResult, sanitizeConfig } from './config.js';
import { handleStatus, statusBodyFor } from './status.js';

/** The body the `status` entry sends. */
type StatusResponseBody = ServerResponse<'status'>;

/**
 * The `status`, `config` and `configApply` handlers.
 *
 * @returns The handlers.
 */
export function standardServerHandlers(): HandlersFor<
  'status' | 'config' | 'configApply'
> {
  const standard = standardHandlers({
    status: handleStatus,
    config: createConfigQueryHandler(() => sanitizeConfig(getConfig())),
    // Bound per request to the file the service loaded (--config).
    configApply: async (request, logger) =>
      redactApplyResult(
        await createConfigApplyHandler(
          serverDescriptor,
          getConfig().configPath,
        )(request, logger),
      ),
  });
  return {
    status: async (_input, request) => {
      const { body } = await handleStatus();
      // Core types `health` loosely; strict response validation checks it.
      return ok(statusBodyFor(body, request) as StatusResponseBody);
    },
    config: standard.config,
    configApply: standard.configApply,
  };
}
