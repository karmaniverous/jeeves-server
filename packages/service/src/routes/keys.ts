/**
 * Key exchange handlers: `pathKey` (`GET /key`) and `insiderKey` (`GET /insider-key`) take the raw machine seed in `X-API-Key` (`machineSeed` entries, verified by the access hook) for machine-to-machine access. Rotation is `POST /api/rotate-key` (api/sharing.ts); the legacy `POST /rotate-key` and `GET /share` are gone (#292, Decision 20).
 *
 * @packageDocumentation
 */

import type { FastifyRequest } from 'fastify';

import { Unauthorized } from '../api/errors.js';
import { type HandlersFor, ok } from '../api/handlerTypes.js';
import { computeInsiderKey, computePathKey } from '../util/crypto.js';

/** The key exchange handlers. */
export const keysHandlers: HandlersFor<'pathKey' | 'insiderKey'> = {
  pathKey: ({ query }, request) =>
    Promise.resolve(
      ok({
        path: query.path,
        key: computePathKey(machineSeedOf(request), query.path),
      }),
    ),
  insiderKey: (_input, request) =>
    Promise.resolve(ok({ key: computeInsiderKey(machineSeedOf(request)) })),
};

/**
 * The seed of the machine key the access hook matched to the `X-API-Key`
 * header (`machineSeed` entries).
 *
 * @param request - The request.
 * @returns The seed.
 * @throws `SERVER_UNAUTHORIZED` (401) when no key was matched.
 */
export function machineSeedOf(request: FastifyRequest): string {
  if (!request.authSeed) throw new Unauthorized('X-API-Key header required');
  return request.authSeed;
}
