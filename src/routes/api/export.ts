/**
 * Export API routes.
 *
 * Handles: /api/export/*, /api/mermaid-export/*, /api/plantuml-export/*
 */

import fs from 'node:fs';
import path from 'node:path';

import type { FastifyPluginAsync } from 'fastify';
import archiver from 'archiver';

import { getConfig } from '../../config/index.js';
import { getRoots, urlPathToFs, getDirSize, type RootEntry } from '../../util/platform.js';
import { DIAGRAM_CONTENT_TYPES } from '../../util/fileDetection.js';
import { type ExportFormat, exportPage } from '../../services/export.js';
import { appendEvent } from '../../services/eventQueue.js';
import { getCachedDiagramBuffer, cacheDiagramBuffer } from '../../services/diagramCache.js';
import { renderMermaidToFile } from '../../services/mermaid.js';
import { renderPlantUmlToBuffer, getPlantUmlFormats } from '../../services/plantuml.js';

let _roots: RootEntry[] = [];

// eslint-disable-next-line @typescript-eslint/require-await
export const exportRoutes: FastifyPluginAsync = async (fastify) => {
  _roots = getRoots(getConfig().roots);

  // GET /api/export/*
  fastify.get<{ Params: { '*': string }; Querystring: { format?: string } }>('/api/export/*', async (request, reply) => {
    const reqPath = request.params['*'];
    if (!reqPath) return reply.code(400).send({ error: 'Path required' });

    const _exportFsPath = urlPathToFs(reqPath, _roots);
    if (!_exportFsPath) return reply.code(404).send({ error: 'Invalid path' });
    const resolved = path.resolve(_exportFsPath);

    if (!fs.existsSync(resolved)) return reply.code(404).send({ error: 'Not found', path: resolved });

    const format = request.query.format ?? 'pdf';
    const stats = fs.statSync(resolved);

    // ZIP export for directories
    if (stats.isDirectory()) {
      if (format !== 'zip') return reply.code(400).send({ error: 'Directories only support ZIP export' });
      const isInsider = request.accessMode === 'insider';
      if (!isInsider) return reply.code(403).send({ error: 'ZIP export requires insider access' });

      const config = getConfig();
      const totalSize = getDirSize(resolved);
      const maxSizeBytes = config.maxZipSizeMb * 1024 * 1024;
      if (totalSize > maxSizeBytes) {
        return reply.code(413).send({
          error: `Directory too large for ZIP export (${Math.round(totalSize / 1024 / 1024)}MB, max ${config.maxZipSizeMb}MB)`,
        });
      }

      const dirName = path.basename(resolved);
      const archive = archiver('zip', { zlib: { level: 6 } });
      reply.header('Content-Type', 'application/zip');
      reply.header('Content-Disposition', `attachment; filename="${dirName}.zip"`);
      reply.send(archive);
      archive.directory(resolved, dirName);
      void archive.finalize();
      return;
    }

    // PDF/DOCX export for files
    if (format !== 'pdf' && format !== 'docx') {
      return reply.code(400).send({ error: 'Files support pdf or docx export' });
    }

    const ext = path.extname(resolved).toLowerCase();
    if (ext !== '.md') return reply.code(400).send({ error: 'Only markdown files support PDF/DOCX export' });

    const config = getConfig();
    const internalKey = config.internalInsiderKey;
    const { port } = config;
    const exportKey = (request.query as { key?: string }).key || internalKey;
    if (!exportKey) return reply.code(500).send({ error: 'Export unavailable — no internal key configured' });

    const exportUrl = `http://localhost:${String(port)}/browse/${reqPath}?key=${exportKey}&render_diagrams=1`;
    const fileName = path.basename(resolved);
    const baseName = fileName.replace(/\.md$/i, '');

    try {
      const buffer = await exportPage({ url: exportUrl, fileName, format: format as ExportFormat });
      const contentType = format === 'pdf'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      const fileExt = format === 'pdf' ? 'pdf' : 'docx';

      return reply
        .header('Content-Type', contentType)
        .header('Content-Disposition', `attachment; filename="${baseName}.${fileExt}"`)
        .header('Content-Length', buffer.length)
        .send(buffer);
    } catch (err) {
      appendEvent({ kind: `${format}_export_error`, error: String(err) });
      return reply.code(500).send({ error: `${format.toUpperCase()} export failed`, details: String(err) });
    }
  });

  // GET /api/mermaid-export/*
  fastify.get<{ Params: { '*': string }; Querystring: { format?: string } }>('/api/mermaid-export/*', async (request, reply) => {
    const reqPath = request.params['*'];
    if (!reqPath) return reply.code(400).send({ error: 'Path required' });

    const _mmdFsPath = urlPathToFs(reqPath, _roots);
    if (!_mmdFsPath) return reply.code(404).send({ error: 'Invalid path' });
    const resolved = path.resolve(_mmdFsPath);

    if (!fs.existsSync(resolved) || !resolved.toLowerCase().endsWith('.mmd')) {
      return reply.code(404).send({ error: 'Mermaid file not found' });
    }

    const mermaidFormats = ['svg', 'png', 'pdf'];
    const format = mermaidFormats.includes(request.query.format ?? '') ? request.query.format! : 'svg';
    const source = fs.readFileSync(resolved, 'utf8');

    // Check cache
    const cachedBuffer = getCachedDiagramBuffer('mermaid', source, format);
    if (cachedBuffer) {
      const downloadName = `${path.basename(resolved, '.mmd')}.${format}`;
      return reply
        .header('Content-Type', DIAGRAM_CONTENT_TYPES[format] ?? 'application/octet-stream')
        .header('Content-Disposition', `attachment; filename="${downloadName}"`)
        .send(cachedBuffer);
    }

    const outFile = renderMermaidToFile(resolved, format);
    if (!outFile) return reply.code(500).send({ error: 'Mermaid render failed' });

    const content = fs.readFileSync(outFile);
    cacheDiagramBuffer('mermaid', source, content, format);
    const downloadName = path.basename(outFile);

    return reply
      .header('Content-Type', DIAGRAM_CONTENT_TYPES[format] ?? 'application/octet-stream')
      .header('Content-Disposition', `attachment; filename="${downloadName}"`)
      .send(content);
  });

  // GET /api/plantuml-export/*
  fastify.get<{ Params: { '*': string }; Querystring: { format?: string } }>('/api/plantuml-export/*', async (request, reply) => {
    const reqPath = request.params['*'];
    if (!reqPath) return reply.code(400).send({ error: 'Path required' });

    const _pumlFsPath = urlPathToFs(reqPath, _roots);
    if (!_pumlFsPath) return reply.code(404).send({ error: 'Invalid path' });
    const resolved = path.resolve(_pumlFsPath);

    const ext = path.extname(resolved).toLowerCase();
    if (!fs.existsSync(resolved) || !['.puml', '.plantuml', '.pu'].includes(ext)) {
      return reply.code(404).send({ error: 'PlantUML file not found' });
    }

    const supported = getPlantUmlFormats();
    const format = supported.includes(request.query.format ?? '') ? request.query.format! : 'svg';
    const source = fs.readFileSync(resolved, 'utf8');

    const cachedBuffer = getCachedDiagramBuffer('plantuml', source, format);
    if (cachedBuffer) {
      const baseName = path.basename(resolved, ext);
      return reply
        .header('Content-Type', DIAGRAM_CONTENT_TYPES[format] ?? 'application/octet-stream')
        .header('Content-Disposition', `attachment; filename="${baseName}.${format}"`)
        .send(cachedBuffer);
    }

    const buffer = await renderPlantUmlToBuffer(resolved, format);
    if (!buffer) return reply.code(500).send({ error: 'PlantUML render failed' });

    cacheDiagramBuffer('plantuml', source, buffer, format);
    const baseName = path.basename(resolved, ext);

    return reply
      .header('Content-Type', DIAGRAM_CONTENT_TYPES[format] ?? 'application/octet-stream')
      .header('Content-Disposition', `attachment; filename="${baseName}.${format}"`)
      .send(buffer);
  });
};
