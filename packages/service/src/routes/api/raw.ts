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
import { attachmentDisposition } from '../../util/contentDisposition.js';
import { getContentType, isInlineType } from '../../util/fileDetection.js';
import { getRoots } from '../../util/platform.js';
import { fsPathOf, NOT_FOUND_MESSAGE, requirePath } from './routePath.js';

/** `download` values that ask for an attachment (#316). */
const DOWNLOAD_VALUES = new Set(['1', 'true']);

/**
 * `raw`: a file's bytes, typed by extension. Non-inline types, and any type
 * with `?download=1` (or `true`), download as an attachment (#316).
 */
export const rawHandlers: HandlersFor<'raw'> = {
  raw: ({ params, query }) => {
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
    const attachment =
      DOWNLOAD_VALUES.has(query.download ?? '') || !isInlineType(contentType);
    return Promise.resolve(
      ok(fs.readFileSync(resolved), {
        'content-type': contentType,
        ...(attachment
          ? {
              'content-disposition': attachmentDisposition(
                path.basename(resolved),
              ),
            }
          : {}),
      }),
    );
  },
};
