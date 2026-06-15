/**
 * Raw file serving API route.
 *
 * Handles: GET /api/raw/*
 */

import fs from 'node:fs';
import path from 'node:path';

import type { FastifyPluginCallback } from 'fastify';

import { getConfig } from '../../config/index.js';
import { getContentType, isInlineType } from '../../util/fileDetection.js';
import { getRoots, urlPathToFs } from '../../util/platform.js';

export const rawRoutes: FastifyPluginCallback = (fastify, _opts, done) => {
  const roots = getRoots(getConfig().roots);

  fastify.get<{ Params: { '*': string } }>(
    '/api/raw/*',
    async (request, reply) => {
      const reqPath = request.params['*'];
      if (!reqPath) return reply.code(400).send({ error: 'Path required' });

      const rawFsPath = urlPathToFs(reqPath, roots);
      if (!rawFsPath) return reply.code(404).send({ error: 'Invalid path' });
      const resolved = path.resolve(rawFsPath);

      if (!fs.existsSync(resolved))
        return reply.code(404).send({ error: 'Not found', path: resolved });

      const stats = fs.statSync(resolved);
      if (stats.isDirectory()) {
        return reply.code(400).send({
          error: 'Cannot serve directory as raw — use /api/export for ZIP',
        });
      }

      const ext = path.extname(resolved).toLowerCase();
      const contentType = getContentType(ext);
      reply.header('Content-Type', contentType);

      if (!isInlineType(contentType)) {
        reply.header(
          'Content-Disposition',
          `attachment; filename="${path.basename(resolved)}"`,
        );
      }

      return reply.send(fs.readFileSync(resolved));
    },
  );
  done();
};
