/**
 * Raw file serving API route.
 *
 * Handles: GET /api/raw/*
 */

import fs from 'node:fs';
import path from 'node:path';

import type { FastifyPluginCallback } from 'fastify';

import { NotAFile, NotFound } from '../../api/errors.js';
import { getConfig } from '../../config/index.js';
import { getContentType, isInlineType } from '../../util/fileDetection.js';
import { getRoots } from '../../util/platform.js';
import { fsPathOf, NOT_FOUND_MESSAGE, requirePath } from './routePath.js';

export const rawRoutes: FastifyPluginCallback = (fastify, _opts, done) => {
  const roots = getRoots(getConfig().roots);

  fastify.get<{ Params: { '*': string } }>(
    '/api/raw/*',
    async (request, reply) => {
      const resolved = fsPathOf(requirePath(request.params['*']), roots);
      if (!fs.existsSync(resolved)) throw new NotFound(NOT_FOUND_MESSAGE);

      const stats = fs.statSync(resolved);
      if (stats.isDirectory())
        throw new NotAFile(
          'Cannot serve directory as raw — use /api/export for ZIP',
        );

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
