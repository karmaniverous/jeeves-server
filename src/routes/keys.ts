/**
 * Key generation and management endpoints
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { FastifyPluginAsync } from 'fastify';

import { getConfig, resetConfig } from '../config/index.js';
import type { LocalConfig } from '../config/types.js';
import { appendEvent } from '../services/eventQueue.js';
import {
  computeInsiderKey,
  computeOutsiderKeyWithExpiry,
  computePathKey,
  timingSafeEqual,
} from '../util/crypto.js';
import { nowIso } from '../util/formatters.js';
import { setKeyRotationTimestamp } from '../util/state.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');

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

      // Find matching seed by raw value
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

  // POST /rotate-key - Rotate API key seed (requires insider key)
  fastify.post<{ Querystring: { key?: string } }>(
    '/rotate-key',
    async (request, reply) => {
      const provided = request.query.key;
      const config = getConfig();

      if (!provided) {
        return reply.code(401).send({ error: 'Insider key required' });
      }

      // Find which seed's insider key matches
      const matched = config.resolvedKeys.find((rk) =>
        timingSafeEqual(provided, computeInsiderKey(rk.seed)),
      );
      if (!matched) {
        return reply.code(401).send({ error: 'Invalid insider key' });
      }

      // Generate new API key seed
      const newSeed = crypto.randomBytes(32).toString('hex');

      // Update config.json.local
      const localConfigPath = path.join(rootDir, 'config.json.local');
      const localConfig = JSON.parse(
        fs.readFileSync(localConfigPath, 'utf8'),
      ) as LocalConfig;

      const entry = localConfig.keys[matched.name];
      if (typeof entry === 'string') {
        localConfig.keys[matched.name] = newSeed;
      } else {
        entry.key = newSeed;
      }

      fs.writeFileSync(
        localConfigPath,
        JSON.stringify(localConfig, null, 2),
        'utf8',
      );

      // Track rotation timestamp
      const rotatedAt = nowIso();
      setKeyRotationTimestamp(rotatedAt);
      appendEvent({
        kind: 'api_key_rotated',
        keyName: matched.name,
        at: rotatedAt,
      });

      // Reset config singleton to reload
      resetConfig();

      // Compute new insider key
      const newInsiderKey = computeInsiderKey(newSeed);

      return { ok: true, insiderKey: newInsiderKey, keyName: matched.name };
    },
  );

  // GET /share - Generate outsider link with optional expiry (requires insider key)
  fastify.get<{ Querystring: { key?: string; path?: string; exp?: string } }>(
    '/share',
    async (request, reply) => {
      const provided = request.query.key;
      const config = getConfig();

      if (!provided) {
        return reply.code(401).send({ error: 'Insider key required' });
      }

      // Find which seed's insider key matches
      const matched = config.resolvedKeys.find((rk) =>
        timingSafeEqual(provided, computeInsiderKey(rk.seed)),
      );
      if (!matched) {
        return reply.code(401).send({ error: 'Invalid insider key' });
      }

      const targetPath = request.query.path;
      if (!targetPath) {
        return reply.code(400).send({ error: 'path query param required' });
      }

      const expiry = request.query.exp;
      let outsiderKey: string;
      let shareUrl: string;

      if (expiry) {
        outsiderKey = computeOutsiderKeyWithExpiry(
          matched.seed,
          targetPath,
          expiry,
        );
        shareUrl = `/path${targetPath}?key=${outsiderKey}&exp=${expiry}`;
      } else {
        outsiderKey = computePathKey(matched.seed, targetPath);
        shareUrl = `/path${targetPath}?key=${outsiderKey}`;
      }

      return {
        path: targetPath,
        key: outsiderKey,
        exp: expiry ?? null,
        url: shareUrl,
      };
    },
  );
};
