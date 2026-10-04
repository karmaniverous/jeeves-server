/**
 * Whole-file write API route for insiders.
 *
 * Handles: PUT /api/file/* (overwrites an existing file; scope-checked)
 *
 * @packageDocumentation
 */

import fs from 'node:fs';
import path from 'node:path';

import type { FastifyPluginAsync } from 'fastify';

import { getConfig } from '../../config/index.js';
import { getRoots, urlPathToFs } from '../../util/platform.js';
import { rejectOutOfScope } from './scopeGuard.js';

export const fileWriteRoutes: FastifyPluginAsync = (fastify) => {
  const roots = getRoots(getConfig().roots);

  fastify.put<{ Params: { '*': string }; Body: { content?: unknown } | null }>(
    '/api/file/*',
    async (request, reply) => {
      if (request.accessMode !== 'insider') {
        return reply.code(403).send({ error: 'Insider access required' });
      }

      const reqPath = request.params['*'];
      // Defence in depth: the auth middleware also enforces scopes.
      if (rejectOutOfScope(request, reply, reqPath)) return reply;

      const fsPath = urlPathToFs(reqPath, roots);
      if (!fsPath) return reply.code(404).send({ error: 'Invalid path' });
      const resolved = path.resolve(fsPath);

      try {
        const stat = await fs.promises.stat(resolved);
        if (!stat.isFile())
          return await reply
            .code(400)
            .send({ error: 'Can only write to files' });
      } catch {
        return reply.code(404).send({ error: 'File not found' });
      }

      const content = request.body?.content;
      if (typeof content !== 'string') {
        return reply
          .code(400)
          .send({ error: 'Request body must include "content" string' });
      }

      try {
        await fs.promises.writeFile(resolved, content, 'utf8');
        return await reply.send({
          ok: true,
          path: resolved,
          size: Buffer.byteLength(content, 'utf8'),
        });
      } catch (err) {
        return reply
          .code(500)
          .send({ error: `Write failed: ${(err as Error).message}` });
      }
    },
  );

  return Promise.resolve();
};
