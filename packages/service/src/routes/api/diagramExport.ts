/**
 * Diagram export routes — standalone Mermaid and PlantUML file rendering.
 *
 * Extracted from export.ts to maintain single responsibility and stay within
 * the 300 LOC limit. Both handlers share a common cache-then-render pattern
 * via `serveDiagramExport()`.
 *
 * @packageDocumentation
 */

import fs from 'node:fs';
import path from 'node:path';

import type { FastifyPluginAsync, FastifyReply } from 'fastify';

import { getConfig } from '../../config/index.js';
import {
  cacheDiagramBuffer,
  getCachedDiagramBuffer,
} from '../../services/diagramCache.js';
import { renderMermaidToFile } from '../../services/mermaid.js';
import {
  getPlantUmlFormats,
  renderPlantUmlToBuffer,
} from '../../services/plantuml.js';
import { DIAGRAM_CONTENT_TYPES } from '../../util/fileDetection.js';
import { getRoots, type RootEntry, urlPathToFs } from '../../util/platform.js';

/** Diagram engine identifier for cache keys. */
type DiagramEngine = 'mermaid' | 'plantuml';

/** Resolve a URL path to a validated filesystem path, or send an error reply. */
function resolveExportPath(
  reqPath: string | undefined,
  roots: RootEntry[],
  reply: FastifyReply,
): string | null {
  if (!reqPath) {
    void reply.code(400).send({ error: 'Path required' });
    return null;
  }
  const fsPath = urlPathToFs(reqPath, roots);
  if (!fsPath) {
    void reply.code(404).send({ error: 'Invalid path' });
    return null;
  }
  return path.resolve(fsPath);
}

/** Send a diagram buffer with appropriate content-type and disposition. */
function sendDiagram(
  reply: FastifyReply,
  buffer: Buffer | Uint8Array,
  format: string,
  downloadName: string,
): void {
  void reply
    .header(
      'Content-Type',
      DIAGRAM_CONTENT_TYPES[format] ?? 'application/octet-stream',
    )
    .header('Content-Disposition', `attachment; filename="${downloadName}"`)
    .send(buffer);
}

/**
 * Serve a diagram export with cache-first semantics.
 *
 * Checks the diagram cache, renders on miss, caches the result, and sends
 * the response. This eliminates the duplicated cache-then-render pattern
 * between the Mermaid and PlantUML handlers.
 */
async function serveDiagramExport(
  reply: FastifyReply,
  engine: DiagramEngine,
  resolved: string,
  ext: string,
  format: string,
  render: (resolved: string, format: string) => Promise<Buffer | null>,
): Promise<void> {
  const source = fs.readFileSync(resolved, 'utf8');
  const baseName = path.basename(resolved, ext);
  const downloadName = `${baseName}.${format}`;

  const cached = getCachedDiagramBuffer(engine, source, format);
  if (cached) {
    sendDiagram(reply, cached, format, downloadName);
    return;
  }

  const buffer = await render(resolved, format);
  if (!buffer) {
    void reply.code(500).send({
      error: `${engine.charAt(0).toUpperCase() + engine.slice(1)} render failed`,
    });
    return;
  }

  cacheDiagramBuffer(engine, source, buffer, format);
  sendDiagram(reply, buffer, format, downloadName);
}

// eslint-disable-next-line @typescript-eslint/require-await
export const diagramExportRoutes: FastifyPluginAsync = async (fastify) => {
  const roots = getRoots(getConfig().roots);

  // GET /api/mermaid-export/*
  fastify.get<{ Params: { '*': string }; Querystring: { format?: string } }>(
    '/api/mermaid-export/*',
    async (request, reply) => {
      const resolved = resolveExportPath(request.params['*'], roots, reply);
      if (!resolved) return;

      if (
        !fs.existsSync(resolved) ||
        !resolved.toLowerCase().endsWith('.mmd')
      ) {
        return reply.code(404).send({ error: 'Mermaid file not found' });
      }

      const mermaidFormats = ['svg', 'png', 'pdf'];
      const format = mermaidFormats.includes(request.query.format ?? '')
        ? request.query.format!
        : 'svg';

      await serveDiagramExport(
        reply,
        'mermaid',
        resolved,
        '.mmd',
        format,
        async (filePath, fmt) => {
          const outFile = await renderMermaidToFile(filePath, fmt);
          return outFile ? fs.readFileSync(outFile) : null;
        },
      );
    },
  );

  // GET /api/plantuml-export/*
  fastify.get<{ Params: { '*': string }; Querystring: { format?: string } }>(
    '/api/plantuml-export/*',
    async (request, reply) => {
      const resolved = resolveExportPath(request.params['*'], roots, reply);
      if (!resolved) return;

      const ext = path.extname(resolved).toLowerCase();
      if (
        !fs.existsSync(resolved) ||
        !['.puml', '.plantuml', '.pu'].includes(ext)
      ) {
        return reply.code(404).send({ error: 'PlantUML file not found' });
      }

      const supported = getPlantUmlFormats();
      const format = supported.includes(request.query.format ?? '')
        ? request.query.format!
        : 'svg';

      await serveDiagramExport(
        reply,
        'plantuml',
        resolved,
        ext,
        format,
        renderPlantUmlToBuffer,
      );
    },
  );
};
