/**
 * Key generation and management endpoints
 */

import crypto from 'node:crypto';
import fs from 'node:fs';

import type { FastifyPluginAsync } from 'fastify';

import { COOKIE_NAME, verifySessionCookie } from '../auth/session.js';
import { getConfig, resetConfig } from '../config/index.js';
import { appendEvent } from '../services/eventQueue.js';
import {
  computeInsiderKey,
  computeOutsiderKeyWithExpiry,
  computePathKey,
  timingSafeEqual,
} from '../util/crypto.js';
import { nowIso } from '../util/formatters.js';
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

      // Try machine key match first
      const matched = config.resolvedKeys.find((rk) =>
        timingSafeEqual(provided, computeInsiderKey(rk.seed)),
      );

      // Try session-based insider rotation
      if (!matched) {
        const sessionSecret = config.sessionSecret;
        const cookieValue = sessionSecret
          ? ((request.cookies as Record<string, string> | undefined)?.[
              COOKIE_NAME
            ] ?? '')
          : '';
        const session =
          sessionSecret && cookieValue
            ? verifySessionCookie(cookieValue, sessionSecret)
            : null;
        if (session) {
          const insider = config.resolvedInsiders.find(
            (i) => i.email.toLowerCase() === session.email.toLowerCase(),
          );
          if (insider?.seed) {
            const rotatedSeed = crypto.randomBytes(32).toString('hex');
            const timestamp = new Date().toISOString();
            
            setInsiderKey(insider.email, rotatedSeed, timestamp);
            appendEvent({
              kind: 'insider_key_rotated',
              email: insider.email,
              at: timestamp,
            });
            resetConfig();
            return { ok: true, keyName: insider.email };
          }
        }
        return reply.code(401).send({ error: 'Invalid insider key' });
      }

      // Generate new machine API key seed
      const newSeed = crypto.randomBytes(32).toString('hex');

      // Machine keys live in config (immutable at runtime with TS config)
      if (!config.configPath.endsWith('.json')) {
        return reply.code(501).send({
          error: 'Machine key rotation is not supported with TypeScript config. ' +
                 'Update the key manually in jeeves.config.ts and restart the server.',
        });
      }

      const fullConfig = JSON.parse(
        fs.readFileSync(config.configPath, 'utf8'),
      ) as Record<string, unknown>;

      const keys = fullConfig.keys as Record<string, unknown>;
      const entry = keys[matched.name];
      if (typeof entry === 'string') {
        keys[matched.name] = newSeed;
      } else if (typeof entry === 'object' && entry !== null) {
        (entry as { key: string }).key = newSeed;
      }

      fs.writeFileSync(
        config.configPath,
        JSON.stringify(fullConfig, null, 2),
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

      // Find which seed's insider key matches (machine keys + insider seeds)
      const matchedMachine = config.resolvedKeys.find((rk) =>
        timingSafeEqual(provided, computeInsiderKey(rk.seed)),
      );
      const matchedInsider = matchedMachine
        ? null
        : config.resolvedInsiders.find(
            (ri) =>
              ri.seed && timingSafeEqual(provided, computeInsiderKey(ri.seed)),
          );
      const matched =
        matchedMachine ??
        (matchedInsider
          ? { name: matchedInsider.email, seed: matchedInsider.seed }
          : null);
      if (!matched) {
        // Also try session cookie auth for share
        const sessionSecret = config.sessionSecret;
        const cookieValue = sessionSecret
          ? ((request.cookies as Record<string, string> | undefined)?.[
              COOKIE_NAME
            ] ?? '')
          : '';
        const session =
          sessionSecret && cookieValue
            ? verifySessionCookie(cookieValue, sessionSecret)
            : null;
        if (session) {
          const insider = config.resolvedInsiders.find(
            (i) => i.email.toLowerCase() === session.email.toLowerCase(),
          );
          if (insider?.seed) {
            const targetPath = request.query.path;
            if (!targetPath) {
              return reply
                .code(400)
                .send({ error: 'path query param required' });
            }
            const expiry = request.query.exp;
            let outsiderKey: string;
            let shareUrl: string;
            if (expiry) {
              outsiderKey = computeOutsiderKeyWithExpiry(
                insider.seed,
                targetPath,
                expiry,
              );
              shareUrl = `/browse${targetPath}?key=${outsiderKey}&exp=${expiry}`;
            } else {
              outsiderKey = computePathKey(insider.seed, targetPath);
              shareUrl = `/browse${targetPath}?key=${outsiderKey}`;
            }
            return {
              path: targetPath,
              key: outsiderKey,
              exp: expiry ?? null,
              url: shareUrl,
            };
          }
        }
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
        shareUrl = `/browse${targetPath}?key=${outsiderKey}&exp=${expiry}`;
      } else {
        outsiderKey = computePathKey(matched.seed, targetPath);
        shareUrl = `/browse${targetPath}?key=${outsiderKey}`;
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
