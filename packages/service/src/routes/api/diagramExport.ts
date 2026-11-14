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

import type { FastifyPluginCallback, FastifyReply } from 'fastify';

import { ExportFailed, NotFound } from '../../api/errors.js';
import { getConfig } from '../../config/index.js';
import {
  cacheDiagramBuffer,
  getCachedDiagramBuffer,
} from '../../services/diagramCache.js';
import {
  type MermaidFormat,
  renderMermaidToBuffer,
} from '../../services/mermaid.js';
import {
  getPlantUmlFormats,
  renderPlantUmlToBuffer,
} from '../../services/plantuml.js';
import { requireChrome } from '../../services/puppeteer.js';
import { DIAGRAM_CONTENT_TYPES } from '../../util/fileDetection.js';
import { getRoots } from '../../util/platform.js';
import { fsPathOf, requirePath } from './routePath.js';

/** Diagram engine identifier for cache keys. */
type DiagramEngine = 'mermaid' | 'plantuml';

/** Capitalised engine names for messages. */
const ENGINE_NAMES: Record<DiagramEngine, string> = {
  mermaid: 'Mermaid',
  plantuml: 'Plantuml',
};

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

  // Mermaid renders in Chrome; its renderer reports any failure as null.
  if (engine === 'mermaid') requireChrome();
  const buffer = await render(resolved, format);
  if (!buffer) throw new ExportFailed(`${ENGINE_NAMES[engine]} render failed`);

  cacheDiagramBuffer(engine, source, buffer, format);
  sendDiagram(reply, buffer, format, downloadName);
}

export const diagramExportRoutes: FastifyPluginCallback = (
  fastify,
  _opts,
  done,
) => {
  const roots = getRoots(getConfig().roots);

  // GET /api/mermaid-export/*
  fastify.get<{ Params: { '*': string }; Querystring: { format?: string } }>(
    '/api/mermaid-export/*',
    async (request, reply) => {
      const resolved = fsPathOf(requirePath(request.params['*']), roots);
      if (!fs.existsSync(resolved) || !resolved.toLowerCase().endsWith('.mmd'))
        throw new NotFound('Mermaid file not found');

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
        (filePath, fmt) =>
          renderMermaidToBuffer(filePath, fmt as MermaidFormat),
      );
    },
  );

  // GET /api/plantuml-export/*
  fastify.get<{ Params: { '*': string }; Querystring: { format?: string } }>(
    '/api/plantuml-export/*',
    async (request, reply) => {
      const resolved = fsPathOf(requirePath(request.params['*']), roots);
      const ext = path.extname(resolved).toLowerCase();
      if (
        !fs.existsSync(resolved) ||
        !['.puml', '.plantuml', '.pu'].includes(ext)
      )
        throw new NotFound('PlantUML file not found');

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
  done();
};
