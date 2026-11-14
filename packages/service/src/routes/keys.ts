/**
 * Key generation and management endpoints (legacy API-key-header auth).
 *
 * `/key` and `/insider-key` take the raw machine seed in `X-API-Key`
 * (`machineSeed` entries, verified by the access hook) for machine-to-machine
 * access. The SPA equivalents in api/sharing.ts use cookie/URL-key auth.
 */

import crypto from 'node:crypto';

import { getUrlKey } from '@karmaniverous/jeeves-server-core';
import type { FastifyPluginCallback, FastifyRequest } from 'fastify';

import {
  InvalidRequest,
  MachineKeyNotRotatable,
  Unauthorized,
} from '../api/errors.js';
import {
  findInsider,
  resolveInsiderKeyAuth,
  resolveSessionAuth,
} from '../auth/resolve.js';
import { getConfig, resetConfig } from '../config/index.js';
import { appendEvent } from '../services/eventQueue.js';
import { createPathShare } from '../services/shareLinks.js';
import { writeInsiderSeedToConfig } from '../util/configPersist.js';
import {
  computeInsiderKey,
  computePathKey,
  timingSafeEqual,
} from '../util/crypto.js';

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

  // POST /rotate-key - Rotate key (insider key or session cookie)
  fastify.post<{ Querystring: { k?: string; key?: string } }>(
    '/rotate-key',
    async (request) => {
      const provided = getUrlKey(request.query);
      const config = getConfig();

      if (provided) {
        // Try insider key auth
        const insiderResult = resolveInsiderKeyAuth(config, provided);
        if (insiderResult.valid && insiderResult.email) {
          // Insider key rotation
          return await rotateInsiderSeed(insiderResult.email, config);
        }

        // Machine key rotation is not supported with TS config
        const matched = config.resolvedKeys.find((rk) =>
          timingSafeEqual(provided, computeInsiderKey(rk.seed)),
        );
        if (matched) throw new MachineKeyNotRotatable();
      }

      // Try session-based auth
      const sessionResult = resolveSessionAuth(config, request);
      if (sessionResult.valid && sessionResult.email) {
        return await rotateInsiderSeed(sessionResult.email, config);
      }

      throw new Unauthorized('Invalid insider key');
    },
  );

  // GET /share - Generate outsider link (insider key or session cookie)
  fastify.get<{
    Querystring: { k?: string; key?: string; path?: string; exp?: string };
  }>('/share', (request) => {
    const config = getConfig();
    const targetPath = request.query.path;
    if (!targetPath) throw new InvalidRequest('path query param required');

    // Try provided key
    const providedKey = getUrlKey(request.query);
    if (providedKey) {
      const insiderResult = resolveInsiderKeyAuth(config, providedKey);
      if (insiderResult.valid && insiderResult.seed) {
        return buildShareResponse(
          insiderResult.seed,
          targetPath,
          request.query.exp,
        );
      }
    }

    // Try session cookie
    const sessionResult = resolveSessionAuth(config, request);
    if (sessionResult.valid && sessionResult.seed) {
      return buildShareResponse(
        sessionResult.seed,
        targetPath,
        request.query.exp,
      );
    }

    throw new Unauthorized('Invalid insider key');
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

async function rotateInsiderSeed(
  email: string,
  config: ReturnType<typeof getConfig>,
) {
  const insider = findInsider(config.resolvedInsiders, email);
  if (!insider?.seed) return { ok: false, error: 'Insider not found' };

  const rotatedSeed = crypto.randomBytes(32).toString('hex');
  const timestamp = new Date().toISOString();

  await writeInsiderSeedToConfig(insider.email, rotatedSeed, timestamp);
  appendEvent({
    kind: 'insider_key_rotated',
    email: insider.email,
    at: timestamp,
  });
  resetConfig();

  return { ok: true, keyName: insider.email };
}

function buildShareResponse(seed: string, targetPath: string, expiry?: string) {
  const { key, url } = createPathShare(seed, targetPath, expiry);
  return { path: targetPath, key, exp: expiry ?? null, url };
}
