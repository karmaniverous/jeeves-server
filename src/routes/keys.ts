/**
 * Key generation and management endpoints
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { FastifyPluginAsync } from 'fastify';

import { verifyKey } from '../auth/keys.js';
import { getConfig } from '../config/index.js';
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

export const keysRoute: FastifyPluginAsync = async (fastify) => {
  // GET /key - Compute path-specific key (requires raw API key)
  fastify.get<{ Querystring: { path?: string } }>(
    '/key',
    async (request, reply) => {
      const provided = request.headers['x-api-key'] as string;
      const config = getConfig();

      if (!provided || !timingSafeEqual(provided, config.apiKey)) {
        return reply.code(401).send({ error: 'X-API-Key header required' });
      }

      const targetPath = request.query.path;
      if (!targetPath) {
        return reply.code(400).send({ error: 'path query param required' });
      }

      const key = computePathKey(config.apiKey, targetPath);
      return { path: targetPath, key };
    },
  );

  // GET /insider-key - Generate insider key (requires raw API key)
  fastify.get('/insider-key', async (request, reply) => {
    const provided = request.headers['x-api-key'] as string;
    const config = getConfig();

    if (!provided || !timingSafeEqual(provided, config.apiKey)) {
      return reply.code(401).send({ error: 'X-API-Key header required' });
    }

    const key = computeInsiderKey(config.apiKey);
    return { key };
  });

  // POST /rotate-key - Rotate API key (requires insider key)
  fastify.post<{ Querystring: { key?: string } }>(
    '/rotate-key',
    async (request, reply) => {
      const provided = request.query.key;
      const config = getConfig();
      const insiderKey = computeInsiderKey(config.apiKey);

      if (!provided || !timingSafeEqual(provided, insiderKey)) {
        return reply.code(401).send({ error: 'Insider key required' });
      }

      // Generate new API key
      const newApiKey = crypto.randomBytes(32).toString('hex');

      // Update config.json.local
      const localConfigPath = path.join(rootDir, 'config.json.local');
      const localConfig = JSON.parse(
        fs.readFileSync(localConfigPath, 'utf8'),
      ) as LocalConfig;
      localConfig.apiKey = newApiKey;
      fs.writeFileSync(
        localConfigPath,
        JSON.stringify(localConfig, null, 2),
        'utf8',
      );

      // Track rotation timestamp
      const rotatedAt = nowIso();
      setKeyRotationTimestamp(rotatedAt);
      appendEvent({ kind: 'api_key_rotated', at: rotatedAt });

      // Compute new insider key
      const newInsiderKey = computeInsiderKey(newApiKey);

      return { ok: true, insiderKey: newInsiderKey };
    },
  );

  // GET /share - Generate outsider link with optional expiry (requires insider key)
  fastify.get<{ Querystring: { key?: string; path?: string; exp?: string } }>(
    '/share',
    async (request, reply) => {
      const provided = request.query.key;
      const config = getConfig();
      const insiderKey = computeInsiderKey(config.apiKey);

      if (!provided || !timingSafeEqual(provided, insiderKey)) {
        return reply.code(401).send({ error: 'Insider key required' });
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
          config.apiKey,
          targetPath,
          expiry,
        );
        shareUrl = `/path${targetPath}?key=${outsiderKey}&exp=${expiry}`;
      } else {
        outsiderKey = computePathKey(config.apiKey, targetPath);
        shareUrl = `/path${targetPath}?key=${outsiderKey}`;
      }

      return {
        path: targetPath,
        key: outsiderKey,
        exp: expiry || null,
        url: shareUrl,
      };
    },
  );
};
