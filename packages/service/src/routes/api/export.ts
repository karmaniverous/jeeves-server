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

import {
  ExportFailed,
  ExportUnsupported,
  InternalKeyMissing,
  NotFound,
} from '../../api/errors.js';
import { type HandlersFor, ok } from '../../api/handlerTypes.js';
import { getConfig } from '../../config/index.js';
import { appendEvent } from '../../services/eventQueue.js';
import { exportPage } from '../../services/export.js';
import {
  cacheExport,
  clearDiagramCacheForFile,
  clearExportCache,
  clearStandaloneDiagramCache,
  getCachedExport,
} from '../../services/exportCache.js';
import { RenderFailedError } from '../../services/puppeteer.js';
import { getRoots } from '../../util/platform.js';
import { pathKeyQuery } from '../../util/shareQuery.js';
import { directoryArchive, isArchiveFormat } from './archiveExport.js';
import { fsPathOf, NOT_FOUND_MESSAGE, requirePath } from './routePath.js';
import { requireInsider } from './scopeGuard.js';

/**
 * Build the loopback URL Puppeteer renders for a document export. The key
 * travels as `k` (#279).
 */
export function buildRenderUrl(
  host: string,
  port: number,
  reqPath: string,
  key: string,
): string {
  return `http://${host}:${String(port)}/browse/${reqPath}?${pathKeyQuery(key)}&render_diagrams=1&plain_code=1`;
}

/**
 * Render a PDF or DOCX export, logging a failure to the event log. A render
 * that did not complete (sign-in page, SPA error, timeout) is
 * `SERVER_EXPORT_FAILED`; `SERVER_CHROME_UNAVAILABLE` from the browser
 * launch passes through; anything else is a masked 500.
 *
 * @param format - The export format.
 * @param render - Renders the document.
 * @returns The rendered bytes.
 */
export async function renderExport(
  format: 'pdf' | 'docx',
  render: () => Promise<Buffer>,
): Promise<Buffer> {
  try {
    return await render();
  } catch (err) {
    appendEvent({ kind: `${format}_export_error`, error: String(err) });
    // Sign-in, error or timed-out render: nothing was cached.
    if (err instanceof RenderFailedError)
      throw new ExportFailed(
        `${format.toUpperCase()} export failed: document did not render`,
      );
    throw err;
  }
}

/** The export handlers: `export` (PDF/DOCX/ZIP/tar), `exportCacheClear`. */
export const exportHandlers: HandlersFor<'export' | 'exportCacheClear'> = {
  export: async ({ params, query }, request) => {
    const reqPath = requirePath(params['*']);
    const resolved = fsPathOf(reqPath, getRoots(getConfig().roots));
    if (!fs.existsSync(resolved)) throw new NotFound(NOT_FOUND_MESSAGE);

    const format = query.format ?? 'pdf';
    const stats = fs.statSync(resolved);

    // ZIP/tar export for directories
    if (stats.isDirectory()) {
      if (!isArchiveFormat(format))
        throw new ExportUnsupported(
          'Directories only support zip or tar export',
        );
      return directoryArchive(request, resolved, reqPath, format);
    }

    // PDF/DOCX export for files
    if (format !== 'pdf' && format !== 'docx')
      throw new ExportUnsupported('Files support pdf or docx export');

    const ext = path.extname(resolved).toLowerCase();
    if (ext !== '.md')
      throw new ExportUnsupported(
        'Only markdown files support PDF/DOCX export',
      );

    // The access hook has already authorised the caller for this path, so
    // render with the server's _internal key whatever link the caller
    // used (expiring and deep keys don't verify on the render URL; #295).
    const config = getConfig();
    const { port } = config;
    const exportKey = config.internalInsiderKey;
    if (!exportKey) throw new InternalKeyMissing();

    const bindAddr = getBindAddress('server');
    // Use loopback if bound to all interfaces (0.0.0.0 is not a valid request target)
    const renderHost = bindAddr === '0.0.0.0' ? '127.0.0.1' : bindAddr;
    const exportUrl = buildRenderUrl(renderHost, port, reqPath, exportKey);
    const fileName = path.basename(resolved);
    const baseName = fileName.replace(/\.md$/i, '');

    const contentType =
      format === 'pdf'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    const fileExt = format === 'pdf' ? 'pdf' : 'docx';

    // Served from the export cache when there; rendered and cached if not.
    const cached = getCachedExport(resolved, format);
    const buffer =
      cached ??
      (await renderExport(format, () =>
        exportPage({
          url: exportUrl,
          fileName,
          format: format,
          authKey: exportKey,
        }),
      ));
    if (!cached) cacheExport(resolved, format, buffer);

    return ok(buffer, {
      'content-type': contentType,
      'content-disposition': `attachment; filename="${baseName}.${fileExt}"`,
      'content-length': String(buffer.length),
    });
  },
  exportCacheClear: async ({ params }, request) => {
    // Insider only: clearing caches is not something a share link grants.
    requireInsider(request);
    const resolved = fsPathOf(
      requirePath(params['*']),
      getRoots(getConfig().roots),
    );

    const { getDiagramCacheDir } =
      await import('../../services/diagramCache.js');
    const diagCacheDir = getDiagramCacheDir();
    const exportCount = clearExportCache(resolved);
    const embeddedCount = clearDiagramCacheForFile(resolved, diagCacheDir);
    const standaloneCount = clearStandaloneDiagramCache(resolved, diagCacheDir);

    return ok({
      cleared: {
        exports: exportCount,
        diagrams: embeddedCount + standaloneCount,
      },
    });
  },
};
