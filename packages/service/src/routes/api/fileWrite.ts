/**
 * Whole-file write API route for insiders.
 *
 * Handles: PUT /api/file/* (overwrites an existing file; scope-checked)
 *
 * @packageDocumentation
 */

import fs from 'node:fs';

import type { FastifyPluginAsync } from 'fastify';

import { InvalidRequest, NotAFile, NotFound } from '../../api/errors.js';
import { getConfig } from '../../config/index.js';
import { getRoots } from '../../util/platform.js';
import { fsPathOf } from './routePath.js';
import { requireInScope, requireInsider } from './scopeGuard.js';

export const fileWriteRoutes: FastifyPluginAsync = (fastify) => {
  const roots = getRoots(getConfig().roots);

  fastify.put<{ Params: { '*': string }; Body: { content?: unknown } | null }>(
    '/api/file/*',
    async (request, reply) => {
      requireInsider(request);

      const reqPath = request.params['*'];
      // Defence in depth: the auth middleware also enforces scopes.
      requireInScope(request, reqPath);

      const resolved = fsPathOf(reqPath, roots);

      const stat = await fs.promises.stat(resolved).catch(() => null);
      if (!stat) throw new NotFound('File not found');
      if (!stat.isFile()) throw new NotAFile('Can only write to files');

      const content = request.body?.content;
      if (typeof content !== 'string')
        throw new InvalidRequest('Request body must include "content" string');

      // A write failure is a logged, masked 500 (the cause names the path).
      await fs.promises.writeFile(resolved, content, 'utf8');
      return reply.send({
        ok: true,
        path: resolved,
        size: Buffer.byteLength(content, 'utf8'),
      });
    },
  );

  return Promise.resolve();
};
