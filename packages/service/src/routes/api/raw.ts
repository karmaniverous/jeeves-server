/**
 * Raw file serving API route.
 *
 * Handles: GET /api/raw/*
 */

import fs from 'node:fs';
import path from 'node:path';

import { NotAFile, NotFound } from '../../api/errors.js';
import { type HandlersFor, ok } from '../../api/handlerTypes.js';
import { getConfig } from '../../config/index.js';
import { getContentType, isInlineType } from '../../util/fileDetection.js';
import { getRoots } from '../../util/platform.js';
import { fsPathOf, NOT_FOUND_MESSAGE, requirePath } from './routePath.js';

/** `raw`: a file's bytes, typed by extension; non-inline types download. */
export const rawHandlers: HandlersFor<'raw'> = {
  raw: ({ params }) => {
    const resolved = fsPathOf(
      requirePath(params['*']),
      getRoots(getConfig().roots),
    );
    if (!fs.existsSync(resolved)) throw new NotFound(NOT_FOUND_MESSAGE);
    if (fs.statSync(resolved).isDirectory())
      throw new NotAFile(
        'Cannot serve directory as raw — use /api/export for ZIP',
      );

    const contentType = getContentType(path.extname(resolved).toLowerCase());
    return Promise.resolve(
      ok(fs.readFileSync(resolved), {
        'content-type': contentType,
        ...(isInlineType(contentType)
          ? {}
          : {
              'content-disposition': `attachment; filename="${path.basename(resolved)}"`,
            }),
      }),
    );
  },
};
