/**
 * Document and directory export routes.
 *
 * Handles: /api/export/* (PDF/DOCX/ZIP), /api/export-cache/* (cache clearing).
 * Diagram export routes (Mermaid/PlantUML) are in diagramExport.ts.
 *
 * @packageDocumentation
 */

import fs from 'node:fs';
import path from 'node:path';

import { getBindAddress } from '@karmaniverous/jeeves';
import archiver from 'archiver';
import type { FastifyPluginAsync } from 'fastify';

import { getConfig } from '../../config/index.js';
import { appendEvent } from '../../services/eventQueue.js';
import { type ExportFormat, exportPage } from '../../services/export.js';
import {
  cacheExport,
  clearDiagramCacheForFile,
  clearExportCache,
  clearStandaloneDiagramCache,
  getCachedExport,
} from '../../services/exportCache.js';
import { getDirSize, getRoots, urlPathToFs } from '../../util/platform.js';

// eslint-disable-next-line @typescript-eslint/require-await
export const exportRoutes: FastifyPluginAsync = async (fastify) => {
  const roots = getRoots(getConfig().roots);

  // GET /api/export/*
  fastify.get<{ Params: { '*': string }; Querystring: { format?: string } }>(
    '/api/export/*',
    async (request, reply) => {
      const reqPath = request.params['*'];
      if (!reqPath) return reply.code(400).send({ error: 'Path required' });

      const exportFsPath = urlPathToFs(reqPath, roots);
      if (!exportFsPath) return reply.code(404).send({ error: 'Invalid path' });
      const resolved = path.resolve(exportFsPath);

      if (!fs.existsSync(resolved))
        return reply.code(404).send({ error: 'Not found', path: resolved });

      const format = request.query.format ?? 'pdf';
      const stats = fs.statSync(resolved);

      // ZIP export for directories
      if (stats.isDirectory()) {
        if (format !== 'zip')
          return reply
            .code(400)
            .send({ error: 'Directories only support ZIP export' });
        const isInsider = request.accessMode === 'insider';
        if (!isInsider)
          return reply
            .code(403)
            .send({ error: 'ZIP export requires insider access' });

        const config = getConfig();
        const totalSize = getDirSize(resolved);
        const maxSizeBytes = config.maxZipSizeMb * 1024 * 1024;
        if (totalSize > maxSizeBytes) {
          return reply.code(413).send({
            error: `Directory too large for ZIP export (${String(Math.round(totalSize / 1024 / 1024))}MB, max ${String(config.maxZipSizeMb)}MB)`,
          });
        }

        const dirName = path.basename(resolved);
        const archive = archiver('zip', { zlib: { level: 6 } });
        reply.header('Content-Type', 'application/zip');
        reply.header(
          'Content-Disposition',
          `attachment; filename="${dirName}.zip"`,
        );
        reply.send(archive);
        archive.directory(resolved, dirName);
        void archive.finalize();
        return;
      }

      // PDF/DOCX export for files
      if (format !== 'pdf' && format !== 'docx') {
        return reply
          .code(400)
          .send({ error: 'Files support pdf or docx export' });
      }

      const ext = path.extname(resolved).toLowerCase();
      if (ext !== '.md')
        return reply
          .code(400)
          .send({ error: 'Only markdown files support PDF/DOCX export' });

      const config = getConfig();
      const internalKey = config.internalInsiderKey;
      const { port } = config;
      const exportKey = (request.query as { key?: string }).key || internalKey;
      if (!exportKey)
        return reply
          .code(500)
          .send({ error: 'Export unavailable — no internal key configured' });

      const bindAddr = getBindAddress('server');
      // Use loopback if bound to all interfaces (0.0.0.0 is not a valid request target)
      const renderHost = bindAddr === '0.0.0.0' ? '127.0.0.1' : bindAddr;
      const exportUrl = `http://${renderHost}:${String(port)}/browse/${reqPath}?key=${exportKey}&render_diagrams=1&plain_code=1`;
      const fileName = path.basename(resolved);
      const baseName = fileName.replace(/\.md$/i, '');

      try {
        const contentType =
          format === 'pdf'
            ? 'application/pdf'
            : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        const fileExt = format === 'pdf' ? 'pdf' : 'docx';

        // Check export cache
        const cached = getCachedExport(resolved, format);
        if (cached) {
          return await reply
            .header('Content-Type', contentType)
            .header(
              'Content-Disposition',
              `attachment; filename="${baseName}.${fileExt}"`,
            )
            .header('Content-Length', cached.length)
            .send(cached);
        }

        const buffer = await exportPage({
          url: exportUrl,
          fileName,
          format: format as ExportFormat,
        });

        // Cache the result
        cacheExport(resolved, format, buffer);

        return await reply
          .header('Content-Type', contentType)
          .header(
            'Content-Disposition',
            `attachment; filename="${baseName}.${fileExt}"`,
          )
          .header('Content-Length', buffer.length)
          .send(buffer);
      } catch (err) {
        appendEvent({ kind: `${format}_export_error`, error: String(err) });
        return reply.code(500).send({
          error: `${format.toUpperCase()} export failed`,
          details: String(err),
        });
      }
    },
  );

  // DELETE /api/export-cache/* — clear all caches for a file
  fastify.delete<{ Params: { '*': string } }>(
    '/api/export-cache/*',
    async (request, reply) => {

      const reqPath = request.params['*'];
      if (!reqPath) return reply.code(400).send({ error: 'Path required' });

      const fsPath = urlPathToFs(reqPath, roots);
      if (!fsPath) return reply.code(404).send({ error: 'Invalid path' });
      const resolved = path.resolve(fsPath);

      const { getDiagramCacheDir } =
        await import('../../services/diagramCache.js');
      const diagCacheDir = getDiagramCacheDir();
      const exportCount = clearExportCache(resolved);
      const embeddedCount = clearDiagramCacheForFile(resolved, diagCacheDir);
      const standaloneCount = clearStandaloneDiagramCache(
        resolved,
        diagCacheDir,
      );

      return reply.send({
        cleared: {
          exports: exportCount,
          diagrams: embeddedCount + standaloneCount,
        },
      });
    },
  );
};
