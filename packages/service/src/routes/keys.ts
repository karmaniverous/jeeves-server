/**
 * Key exchange endpoints: `/key` and `/insider-key` take the raw machine
 * seed in `X-API-Key` (`machineSeed` entries, verified by the access hook)
 * for machine-to-machine access. Rotation is `POST /api/rotate-key`
 * (api/sharing.ts); the legacy `POST /rotate-key` and `GET /share` are
 * gone (#292, Decision 20).
 */

import type { FastifyPluginCallback, FastifyRequest } from 'fastify';

import { InvalidRequest, Unauthorized } from '../api/errors.js';
import { computeInsiderKey, computePathKey } from '../util/crypto.js';

export const keysRoute: FastifyPluginCallback = (fastify, _opts, done) => {
  // GET /key - Compute path-specific outsider key (requires raw API key seed in header)
  fastify.get<{ Querystring: { path?: string } }>('/key', (request) => {
    const seed = machineSeedOf(request);

    const targetPath = request.query.path;
    if (!targetPath) throw new InvalidRequest('path query param required');

    const key = computePathKey(seed, targetPath);
    return { path: targetPath, key };
  });

  // GET /insider-key - Generate insider key (requires raw API key seed in header)
  fastify.get('/insider-key', (request) => {
    const key = computeInsiderKey(machineSeedOf(request));
    return { key };
  });

  done();
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
