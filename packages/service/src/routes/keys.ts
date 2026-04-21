/**
 * Key generation and management endpoints (legacy API-key-header auth).
 *
 * These endpoints use X-API-Key header auth (raw seed) for machine-to-machine
 * access. The SPA equivalents in api/sharing.ts use cookie/URL-key auth.
 */

import crypto from 'node:crypto';

import type { FastifyPluginAsync } from 'fastify';

import {
  findInsider,
  resolveInsiderKeyAuth,
  resolveSessionAuth,
} from '../auth/resolve.js';
import { getConfig, resetConfig } from '../config/index.js';
import { appendEvent } from '../services/eventQueue.js';
import {
  computeInsiderKey,
  computeOutsiderKeyWithExpiry,
  computePathKey,
  timingSafeEqual,
} from '../util/crypto.js';
import { setInsiderKey, setKeyRotationTimestamp } from '../util/state.js';

// eslint-disable-next-line @typescript-eslint/require-await
export const keysRoute: FastifyPluginAsync = async (fastify) => {
  // GET /key - Compute path-specific outsider key (requires raw API key seed in header)
  fastify.get<{ Querystring: { path?: string } }>(
    '/key',
    async (request, reply) => {
      const provided = request.headers['x-api-key'] as string;
      const config = getConfig();

      if (!provided) {
        return reply.code(401).send({ error: 'X-API-Key header required' });
      }

      const matched = config.resolvedKeys.find((rk) =>
        timingSafeEqual(provided, rk.seed),
      );
      if (!matched) {
        return reply.code(401).send({ error: 'Invalid API key' });
      }

      const targetPath = request.query.path;
      if (!targetPath) {
        return reply.code(400).send({ error: 'path query param required' });
      }

      const key = computePathKey(matched.seed, targetPath);
      return { path: targetPath, key };
    },
  );

  // GET /insider-key - Generate insider key (requires raw API key seed in header)
  fastify.get('/insider-key', async (request, reply) => {
    const provided = request.headers['x-api-key'] as string;
    const config = getConfig();

    if (!provided) {
      return reply.code(401).send({ error: 'X-API-Key header required' });
    }

    const matched = config.resolvedKeys.find((rk) =>
      timingSafeEqual(provided, rk.seed),
    );
    if (!matched) {
      return reply.code(401).send({ error: 'Invalid API key' });
    }

    const key = computeInsiderKey(matched.seed);
    return { key };
  });

  // POST /rotate-key - Rotate key (insider key or session cookie)
  fastify.post<{ Querystring: { key?: string } }>(
    '/rotate-key',
    async (request, reply) => {
      const provided = request.query.key;
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
        if (matched) {
          return reply.code(501).send({
            error:
              'Machine key rotation is not supported with TypeScript config. ' +
              'Update the key manually in jeeves.config.ts and restart the server.',
          });
        }
      }

      // Try session-based auth
      const sessionResult = resolveSessionAuth(config, request);
      if (sessionResult.valid && sessionResult.email) {
        return await rotateInsiderSeed(sessionResult.email, config);
      }

      return reply.code(401).send({ error: 'Invalid insider key' });
    },
  );

  // GET /share - Generate outsider link (insider key or session cookie)
  fastify.get<{ Querystring: { key?: string; path?: string; exp?: string } }>(
    '/share',
    async (request, reply) => {
      const config = getConfig();
      const targetPath = request.query.path;
      if (!targetPath) {
        return reply.code(400).send({ error: 'path query param required' });
      }

      // Try provided key
      if (request.query.key) {
        const insiderResult = resolveInsiderKeyAuth(config, request.query.key);
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

      return reply.code(401).send({ error: 'Invalid insider key' });
    },
  );
};

async function rotateInsiderSeed(
  email: string,
  config: ReturnType<typeof getConfig>,
) {
  const insider = findInsider(config.resolvedInsiders, email);
  if (!insider?.seed) return { ok: false, error: 'Insider not found' };

  const rotatedSeed = crypto.randomBytes(32).toString('hex');
  const timestamp = new Date().toISOString();

  await setInsiderKey(insider.email, rotatedSeed, timestamp);
  appendEvent({
    kind: 'insider_key_rotated',
    email: insider.email,
    at: timestamp,
  });
  setKeyRotationTimestamp(timestamp);
  resetConfig();

  return { ok: true, keyName: insider.email };
}

function buildShareResponse(seed: string, targetPath: string, expiry?: string) {
  let outsiderKey: string;
  let shareUrl: string;

  if (expiry) {
    outsiderKey = computeOutsiderKeyWithExpiry(seed, targetPath, expiry);
    shareUrl = `/browse${targetPath}?key=${outsiderKey}&exp=${expiry}`;
  } else {
    outsiderKey = computePathKey(seed, targetPath);
    shareUrl = `/browse${targetPath}?key=${outsiderKey}`;
  }

  return {
    path: targetPath,
    key: outsiderKey,
    exp: expiry ?? null,
    url: shareUrl,
  };
}
