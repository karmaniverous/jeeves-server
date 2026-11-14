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

import { ExportFailed, NotFound } from '../../api/errors.js';
import { type HandlersFor, ok } from '../../api/handlerTypes.js';
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
import { attachmentDisposition } from '../../util/contentDisposition.js';
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

/** A diagram buffer with its content-type and download disposition. */
function diagramResult(
  buffer: Buffer | Uint8Array,
  format: string,
  downloadName: string,
) {
  return ok(buffer, {
    'content-type': DIAGRAM_CONTENT_TYPES[format] ?? 'application/octet-stream',
    'content-disposition': attachmentDisposition(downloadName),
  });
}

/**
 * Serve a diagram export with cache-first semantics.
 *
 * Checks the diagram cache, renders on miss, caches the result, and
 * returns the response. This eliminates the duplicated cache-then-render pattern
 * between the Mermaid and PlantUML handlers.
 */
async function serveDiagramExport(
  engine: DiagramEngine,
  resolved: string,
  ext: string,
  format: string,
  render: (resolved: string, format: string) => Promise<Buffer | null>,
): Promise<ReturnType<typeof diagramResult>> {
  const source = fs.readFileSync(resolved, 'utf8');
  const baseName = path.basename(resolved, ext);
  const downloadName = `${baseName}.${format}`;

  const cached = getCachedDiagramBuffer(engine, source, format);
  if (cached) return diagramResult(cached, format, downloadName);

  // Mermaid renders in Chrome; its renderer reports any failure as null.
  if (engine === 'mermaid') requireChrome();
  const buffer = await render(resolved, format);
  if (!buffer) throw new ExportFailed(`${ENGINE_NAMES[engine]} render failed`);

  cacheDiagramBuffer(engine, source, buffer, format);
  return diagramResult(buffer, format, downloadName);
}

/** The `exportMermaid` and `exportPlantUml` handlers. */
export const diagramExportHandlers: HandlersFor<
  'exportMermaid' | 'exportPlantUml'
> = {
  exportMermaid: ({ params, query }) => {
    const resolved = fsPathOf(
      requirePath(params['*']),
      getRoots(getConfig().roots),
    );
    if (!fs.existsSync(resolved) || !resolved.toLowerCase().endsWith('.mmd'))
      throw new NotFound('Mermaid file not found');

    const mermaidFormats = ['svg', 'png', 'pdf'];
    const format =
      query.format && mermaidFormats.includes(query.format)
        ? query.format
        : 'svg';

    return serveDiagramExport(
      'mermaid',
      resolved,
      '.mmd',
      format,
      (filePath, fmt) => renderMermaidToBuffer(filePath, fmt as MermaidFormat),
    );
  },
  exportPlantUml: ({ params, query }) => {
    const resolved = fsPathOf(
      requirePath(params['*']),
      getRoots(getConfig().roots),
    );
    const ext = path.extname(resolved).toLowerCase();
    if (
      !fs.existsSync(resolved) ||
      !['.puml', '.plantuml', '.pu'].includes(ext)
    )
      throw new NotFound('PlantUML file not found');

    const supported = getPlantUmlFormats();
    const format =
      query.format && supported.includes(query.format) ? query.format : 'svg';

    return serveDiagramExport(
      'plantuml',
      resolved,
      ext,
      format,
      renderPlantUmlToBuffer,
    );
  },
};
