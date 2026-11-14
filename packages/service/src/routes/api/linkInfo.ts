/**
 * Link availability: the `linkInfo` handler (`GET /api/link-info/*`), what views and exports are available for a path.
 *
 * @packageDocumentation
 */

import fs from 'node:fs';
import path from 'node:path';

import { type HandlersFor, ok } from '../../api/handlerTypes.js';
import { getConfig } from '../../config/index.js';
import { getPlantUmlFormats } from '../../services/plantuml.js';
import { getRoots } from '../../util/platform.js';
import { fsPathOf, requirePath } from './routePath.js';
import { requireInScope } from './scopeGuard.js';

/** `linkInfo`: what views and exports exist for a path. */
export const linkInfoHandlers: HandlersFor<'linkInfo'> = {
  linkInfo: ({ params }, request) => {
    const reqPath = requirePath(params['*']);
    const resolved = fsPathOf(reqPath, getRoots(getConfig().roots));

    let stats: ReturnType<typeof fs.statSync>;
    try {
      stats = fs.statSync(resolved);
    } catch {
      return Promise.resolve(ok({ exists: false as const }));
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

    return Promise.resolve(
      ok({
        exists: true as const,
        isDirectory,
        pageUrl,
        rawUrl,
        exportLinks,
      }),
    );
  },
};
