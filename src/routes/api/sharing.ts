/**
 * Sharing API routes.
 *
 * Handles: /api/share, /api/util/share-for, /api/readme-link, /api/rotate-key
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { FastifyPluginAsync } from 'fastify';

import { _pathMatchesScopes } from '../../auth/keys.js';
import {
  computeDeepShareKey,
  computeOutsiderKeyWithExpiry,
  computePathKey,
  type DeepShareParams,
} from '../../util/crypto.js';
import { getConfig, resetConfig } from '../../config/index.js';
import type { NormalizedScopes } from '../../config/types.js';
import { setInsiderKey } from '../../util/state.js';
import { getRoots, fsPathToUrl, type RootEntry } from '../../util/platform.js';
import { encodeStack } from '../../services/deepShareLinks.js';

let _roots: RootEntry[] = [];

// eslint-disable-next-line @typescript-eslint/require-await
export const sharingRoutes: FastifyPluginAsync = async (fastify) => {
  _roots = getRoots(getConfig().roots);

  // GET /api/readme-link
  fastify.get('/api/readme-link', async (_request, reply) => {
    const config = getConfig();
    const internalKey = config.resolvedKeys.find(k => k.name === '_internal');
    if (!internalKey?.seed) return reply.code(503).send({ error: 'No _internal key configured' });

    const seed = internalKey.seed;
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const serverRoot = path.resolve(__dirname, '..', '..', '..');
    const readmePath = path.join(serverRoot, 'README.md');
    if (!fs.existsSync(readmePath)) return reply.code(404).send({ error: 'README.md not found' });

    const urlPath = fsPathToUrl(readmePath, _roots);
    const stack = encodeStack([urlPath]);
    const deepParams = { depth: 2, dirs: false, stack, exp: undefined };
    const key = computeDeepShareKey(seed, urlPath, deepParams);
    const shareUrl = `/browse${urlPath}?key=${key}&d=2&dirs=0&s=${stack}`;

    return reply.send({ url: shareUrl });
  });

  // POST /api/share
  fastify.post<{ Body: { path: string; expiry?: string; depth?: number; dirs?: boolean } }>('/api/share', async (request, reply) => {
    const seed = request.authSeed;
    if (!seed) return reply.code(401).send({ error: 'Insider auth required' });

    const { path: targetPath, expiry, depth, dirs } = request.body;
    if (!targetPath) return reply.code(400).send({ error: 'path is required' });

    let outsiderKey: string;
    let shareUrl: string;

    if ((depth && depth > 0) || dirs) {
      const stack = encodeStack([targetPath]);
      const deepParams: DeepShareParams = { depth: depth ?? 0, dirs: dirs ?? false, stack, exp: expiry };
      outsiderKey = computeDeepShareKey(seed, targetPath, deepParams);
      shareUrl = `/browse${targetPath}?key=${outsiderKey}&d=${String(depth ?? 0)}&dirs=${dirs ? '1' : '0'}&s=${stack}`;
      if (expiry) shareUrl += `&exp=${expiry}`;
    } else if (expiry) {
      outsiderKey = computeOutsiderKeyWithExpiry(seed, targetPath, expiry);
      shareUrl = `/browse${targetPath}?key=${outsiderKey}&exp=${expiry}`;
    } else {
      outsiderKey = computePathKey(seed, targetPath);
      shareUrl = `/browse${targetPath}?key=${outsiderKey}`;
    }

    return reply.send({ url: shareUrl, path: targetPath, exp: expiry ?? null, depth: depth ?? 0, dirs: dirs ?? false });
  });

  // POST /api/rotate-key
  fastify.post('/api/rotate-key', async (request, reply) => {
    const insiderEmail = request.insiderEmail;
    if (!insiderEmail) return reply.code(403).send({ error: 'Insider auth required' });

    const config = getConfig();
    const insider = config.resolvedInsiders.find(
      (i) => i.email.toLowerCase() === insiderEmail.toLowerCase(),
    );
    if (!insider) return reply.code(403).send({ error: 'Not an insider' });

    const newSeed = crypto.randomBytes(32).toString('hex');
    const now = new Date().toISOString();
    setInsiderKey(insider.email, newSeed, now);
    resetConfig();

    return reply.send({ ok: true, keyCreatedAt: now });
  });

  // POST /api/util/share-for
  fastify.post<{
    Body: {
      path: string;
      insiders: string[];
      depth?: number;
      dirs?: boolean;
      enforceOutsiderPolicy?: boolean;
    };
  }>('/api/util/share-for', async (request, reply) => {
    const config = getConfig();
    const sharerSeed = request.authSeed;
    const sharerScopes = request.insiderScopes ?? null;
    if (!sharerSeed) return reply.code(401).send({ error: 'Authentication required' });

    const { path: targetPath, insiders: audienceIds, depth, dirs, enforceOutsiderPolicy } = request.body;
    if (!targetPath) return reply.code(400).send({ error: 'path is required' });
    if (!audienceIds || !Array.isArray(audienceIds)) return reply.code(400).send({ error: 'insiders array is required' });

    if (sharerScopes && !_pathMatchesScopes(targetPath, sharerScopes)) {
      return reply.send({ url: null, type: 'blocked', reason: 'Sharer does not have access to this path', blocked: [] });
    }

    const blockedInsiders: string[] = [];
    const unknownIds: string[] = [];

    for (const id of audienceIds) {
      const insider = config.resolvedInsiders.find(
        (ri) => ri.email.toLowerCase() === id.toLowerCase(),
      );
      if (!insider || !insider.seed) { unknownIds.push(id); continue; }
      if (insider.scopes && !_pathMatchesScopes(targetPath, insider.scopes)) {
        blockedInsiders.push(id);
      }
    }

    if (blockedInsiders.length > 0) {
      return reply.send({ url: null, type: 'blocked', reason: 'Insider(s) do not have access to this path', blocked: blockedInsiders });
    }

    const hasOutsiders = unknownIds.length > 0;

    if (!hasOutsiders) {
      const proto = request.headers['x-forwarded-proto'] || 'https';
      const host = request.headers['x-forwarded-host'] || request.headers.host;
      return reply.send({ url: `${proto}://${host}/browse${targetPath}`, type: 'insider' });
    }

    const outsiderPolicy = config.outsiderPolicy;
    const policyEnforced = enforceOutsiderPolicy !== false;

    if (outsiderPolicy && policyEnforced) {
      if (!_pathMatchesScopes(targetPath, outsiderPolicy)) {
        return reply.send({ url: null, type: 'policy-denied', reason: 'Outsider policy does not allow sharing this path' });
      }
    }

    const shareDepth = depth ?? 0;
    const shareDirs = dirs ?? false;
    const stack = encodeStack([targetPath]);
    const deepParams: DeepShareParams = { depth: shareDepth, dirs: shareDirs, stack };
    const outsiderKey = computeDeepShareKey(sharerSeed, targetPath, deepParams);
    const proto = request.headers['x-forwarded-proto'] || 'https';
    const host = request.headers['x-forwarded-host'] || request.headers.host;

    let shareUrl = `${proto}://${host}/browse${targetPath}?key=${outsiderKey}`;
    if (shareDepth > 0) shareUrl += `&d=${shareDepth}`;
    shareUrl += `&dirs=${shareDirs ? 1 : 0}`;
    if (stack) shareUrl += `&s=${stack}`;

    const response: Record<string, unknown> = { url: shareUrl, type: 'outsider-share' };

    if (outsiderPolicy && !policyEnforced && !_pathMatchesScopes(targetPath, outsiderPolicy)) {
      response.warning = 'Outsider policy would deny this path';
    }

    return reply.send(response);
  });
};
