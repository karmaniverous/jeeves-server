/**
 * Link availability: the `linkInfo` handler (`GET /api/link-info/*`), what views and exports are available for a path.
 *
 * @packageDocumentation
 */

import fs from 'node:fs';
import path from 'node:path';

import { type HandlersFor, ok } from '../../api/handlerTypes.js';
import { getConfig } from '../../config/index.js';
import { loadMarkdownDocument } from '../../services/markdownDocument.js';
import { getPlantUmlFormats } from '../../services/plantuml.js';
import { PLANTUML_EXTS } from '../../util/fileDetection.js';
import { getRoots } from '../../util/platform.js';
import { fsPathOf, requirePath } from './routePath.js';
import { requireInScope } from './scopeGuard.js';

/** `linkInfo`: what views and exports exist for a path. */
export const linkInfoHandlers: HandlersFor<'linkInfo'> = {
  linkInfo: async ({ params }, request) => {
    const reqPath = requirePath(params['*']);
    const resolved = fsPathOf(reqPath, getRoots(getConfig().roots));

    let stats: ReturnType<typeof fs.statSync>;
    try {
      stats = fs.statSync(resolved);
    } catch {
      return ok({ exists: false as const });
    }
    const isDirectory = stats.isDirectory();
    // Navigation access covers directories; files must be in scope.
    if (!isDirectory) requireInScope(request, reqPath);
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

      if (ext === '.mmd') {
        for (const fmt of ['svg', 'png', 'pdf']) {
          exportLinks.push({
            format: fmt,
            url: `/api/mermaid-export/${reqPath}?format=${fmt}`,
          });
        }
      } else if (PLANTUML_EXTS.includes(ext)) {
        for (const fmt of getPlantUmlFormats()) {
          exportLinks.push({
            format: fmt,
            url: `/api/plantuml-export/${reqPath}?format=${fmt}`,
          });
        }
      } else if (await loadMarkdownDocument(resolved)) {
        // Whatever export accepts: native or watcher-rendered Markdown.
        exportLinks.push(
          { format: 'pdf', url: `/api/export/${reqPath}?format=pdf` },
          { format: 'docx', url: `/api/export/${reqPath}?format=docx` },
        );
      }
    }

    return ok({
      exists: true as const,
      isDirectory,
      pageUrl,
      rawUrl,
      exportLinks,
    });
  },
};
