/**
 * Link availability query endpoint.
 * Returns what views and exports are available for a given path.
 */

import fs from 'node:fs';
import path from 'node:path';

import type { FastifyPluginCallback } from 'fastify';

import { getConfig } from '../../config/index.js';
import { getPlantUmlFormats } from '../../services/plantuml.js';
import { getRoots, urlPathToFs } from '../../util/platform.js';

export const linkInfoRoutes: FastifyPluginCallback = (fastify, _opts, done) => {
  const roots = getRoots(getConfig().roots);

  fastify.get<{ Params: { '*': string } }>(
    '/api/link-info/*',
    async (request, reply) => {
      const reqPath = request.params['*'];
      if (!reqPath) return reply.code(400).send({ error: 'Path required' });

      const fsPath = urlPathToFs(reqPath, roots);
      if (!fsPath) return reply.code(404).send({ error: 'Invalid path' });
      const resolved = path.resolve(fsPath);

      let stats: ReturnType<typeof fs.statSync>;
      try {
        stats = fs.statSync(resolved);
      } catch {
        return reply.send({ exists: false });
      }
      const isDirectory = stats.isDirectory();
      const ext = path.extname(resolved).toLowerCase();

      const pageUrl = `/browse/${reqPath}`;
      let rawUrl: string | null = null;
      const exportLinks: { format: string; url: string }[] = [];

      if (isDirectory) {
        if (request.accessMode === 'insider') {
          exportLinks.push({
            format: 'zip',
            url: `/api/export/${reqPath}?format=zip`,
          });
        }
      } else {
        rawUrl = `/api/raw/${reqPath}`;

        if (ext === '.md' || ext === '.markdown') {
          exportLinks.push(
            { format: 'pdf', url: `/api/export/${reqPath}?format=pdf` },
            { format: 'docx', url: `/api/export/${reqPath}?format=docx` },
          );
        } else if (ext === '.mmd') {
          for (const fmt of ['svg', 'png', 'pdf']) {
            exportLinks.push({
              format: fmt,
              url: `/api/mermaid-export/${reqPath}?format=${fmt}`,
            });
          }
        } else if (['.puml', '.plantuml', '.pu'].includes(ext)) {
          for (const fmt of getPlantUmlFormats()) {
            exportLinks.push({
              format: fmt,
              url: `/api/plantuml-export/${reqPath}?format=${fmt}`,
            });
          }
        }
      }

      return reply.send({
        exists: true,
        isDirectory,
        pageUrl,
        rawUrl,
        exportLinks,
      });
    },
  );
  done();
};
