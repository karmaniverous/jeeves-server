/**
 * Sharing API routes.
 *
 * Handles: /api/share, /api/util/share-for, /api/readme-link, /api/rotate-key
 *
 * @packageDocumentation
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { FastifyPluginCallback, FastifyReply } from 'fastify';
import { packageDirectorySync } from 'package-directory';

import { _pathMatchesScopes } from '../../auth/keys.js';
import { findInsider } from '../../auth/resolve.js';
import { getConfig, resetConfig } from '../../config/index.js';
import { isDirectoryUrlPath } from '../../services/contentPath.js';
import { createDeepShare, createPathShare } from '../../services/shareLinks.js';
import { writeInsiderSeedToConfig } from '../../util/configPersist.js';
import { fsPathToUrl, getRoots } from '../../util/platform.js';
import { getPublicOrigin } from '../../util/publicOrigin.js';
import { rejectOutOfScope } from './scopeGuard.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Resolve the package root via `package-directory` rather than fixed `..`
 * hops, which break when the compiled output adds a `dist/` layer.
 */
const serverRoot = packageDirectorySync({ cwd: __dirname }) ?? __dirname;

export const sharingRoutes: FastifyPluginCallback = (fastify, _opts, done) => {
  const roots = getRoots(getConfig().roots);

  /** Resolve the _internal key seed, or send a 503 error. */
  function getInternalSeed(reply: FastifyReply): string | null {
    const internalKey = getConfig().resolvedKeys.find(
      (k) => k.name === '_internal',
    );
    if (!internalKey?.seed) {
      void reply.code(503).send({ error: 'No _internal key configured' });
      return null;
    }
    return internalKey.seed;
  }

  // GET /api/readme-link
  fastify.get('/api/readme-link', async (_request, reply) => {
    const seed = getInternalSeed(reply);
    if (!seed) return;

    const readmePath = path.join(serverRoot, 'README.md');
    if (!fs.existsSync(readmePath))
      return reply.code(404).send({ error: 'README.md not found' });

    const urlPath = fsPathToUrl(readmePath, roots);
    const { url } = createDeepShare(seed, urlPath, { depth: 2, dirs: false });
    return reply.send({ url });
  });

  // GET /api/content-link/:file — share link for content/*.md (terms, privacy)
  fastify.get('/api/content-link/:file', async (request, reply) => {
    const seed = getInternalSeed(reply);
    if (!seed) return;

    const { file } = request.params as { file: string };
    if (!/^[\w-]+$/.test(file))
      return reply.code(400).send({ error: 'Invalid file name' });

    const contentPath = path.join(serverRoot, 'content', `${file}.md`);
    if (!fs.existsSync(contentPath))
      return reply.code(404).send({ error: `${file}.md not found` });

    const urlPath = fsPathToUrl(contentPath, roots);
    const { url } = createDeepShare(seed, urlPath, { depth: 0, dirs: false });
    return reply.send({ url });
  });

  // POST /api/share
  fastify.post<{
    Body: { path: string; expiry?: string; depth?: number; dirs?: boolean };
  }>('/api/share', async (request, reply) => {
    const seed = request.authSeed;
    if (!seed) return reply.code(401).send({ error: 'Insider auth required' });

    const { path: targetPath, expiry, depth, dirs } = request.body;
    if (!targetPath) return reply.code(400).send({ error: 'path is required' });

    if (rejectOutOfScope(request, reply, targetPath)) return reply;

    const share =
      (depth && depth > 0) || dirs
        ? createDeepShare(seed, targetPath, {
            depth: depth ?? 0,
            dirs: dirs ?? false,
            exp: expiry,
          })
        : createPathShare(seed, targetPath, expiry);

    return reply.send({
      url: share.url,
      path: targetPath,
      exp: expiry ?? null,
      depth: depth ?? 0,
      dirs: dirs ?? false,
      isDirectory: isDirectoryUrlPath(targetPath),
    });
  });

  // POST /api/rotate-key
  fastify.post('/api/rotate-key', async (request, reply) => {
    const insiderEmail = request.insiderEmail;
    if (!insiderEmail)
      return reply.code(403).send({ error: 'Insider auth required' });

    const config = getConfig();
    const insider = findInsider(config.resolvedInsiders, insiderEmail);
    if (!insider) return reply.code(403).send({ error: 'Not an insider' });

    const newSeed = crypto.randomBytes(32).toString('hex');
    const now = new Date().toISOString();
    await writeInsiderSeedToConfig(insider.email, newSeed, now);
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
    if (!sharerSeed)
      return reply.code(401).send({ error: 'Authentication required' });

    const {
      path: targetPath,
      insiders: audienceIds,
      depth,
      dirs,
      enforceOutsiderPolicy,
    } = request.body;
    if (!targetPath) return reply.code(400).send({ error: 'path is required' });
    if (!Array.isArray(audienceIds))
      return reply.code(400).send({ error: 'insiders array is required' });

    if (sharerScopes && !_pathMatchesScopes(targetPath, sharerScopes)) {
      return reply.send({
        url: null,
        type: 'blocked',
        reason: 'Sharer does not have access to this path',
        blocked: [],
      });
    }

    const blockedInsiders: string[] = [];
    const unknownIds: string[] = [];

    for (const id of audienceIds) {
      const insider = findInsider(config.resolvedInsiders, id);
      if (!insider || !insider.seed) {
        unknownIds.push(id);
        continue;
      }
      if (insider.scopes && !_pathMatchesScopes(targetPath, insider.scopes)) {
        blockedInsiders.push(id);
      }
    }

    if (blockedInsiders.length > 0) {
      return reply.send({
        url: null,
        type: 'blocked',
        reason: 'Insider(s) do not have access to this path',
        blocked: blockedInsiders,
      });
    }

    const hasOutsiders = unknownIds.length > 0;

    // Absolute URLs only from the configured public origin; otherwise
    // relative (never from untrusted request headers).
    const origin = getPublicOrigin(config, request) ?? '';

    if (!hasOutsiders) {
      return reply.send({
        url: `${origin}/browse${targetPath}`,
        type: 'insider',
      });
    }

    const outsiderPolicy = config.outsiderPolicy;
    const policyEnforced = enforceOutsiderPolicy !== false;

    if (outsiderPolicy && policyEnforced) {
      if (!_pathMatchesScopes(targetPath, outsiderPolicy)) {
        return reply.send({
          url: null,
          type: 'policy-denied',
          reason: 'Outsider policy does not allow sharing this path',
        });
      }
    }

    const shareDepth = depth ?? 0;
    const shareDirs = dirs ?? false;
    // A directory shared without depth or dirs is a tree share: a plain path
    // key covers every file below it, as the UI's directory links do.
    // Otherwise the same deep share as POST /api/share, which always emits
    // d (also d=0) so verification recognises a deep key (#282).
    const share =
      shareDepth <= 0 && !shareDirs && isDirectoryUrlPath(targetPath)
        ? createPathShare(sharerSeed, targetPath)
        : createDeepShare(sharerSeed, targetPath, {
            depth: shareDepth,
            dirs: shareDirs,
          });

    const response: Record<string, unknown> = {
      url: `${origin}${share.url}`,
      type: 'outsider-share',
    };

    if (
      outsiderPolicy &&
      !policyEnforced &&
      !_pathMatchesScopes(targetPath, outsiderPolicy)
    ) {
      response.warning = 'Outsider policy would deny this path';
    }

    return reply.send(response);
  });
  done();
};
