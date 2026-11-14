/**
 * Whole-file write API route for insiders.
 *
 * Handler: `fileWrite` (PUT /api/file/*; overwrites an existing file; scope-checked)
 *
 * @packageDocumentation
 */

import fs from 'node:fs';

import { NotAFile, NotFound } from '../../api/errors.js';
import { type HandlersFor, ok } from '../../api/handlerTypes.js';
import { getConfig } from '../../config/index.js';
import { withFileLock } from '../../util/fileMutex.js';
import { getRoots } from '../../util/platform.js';
import { fsPathOf } from './routePath.js';
import { requireInScope, requireInsider } from './scopeGuard.js';

/**
 * `fileWrite`: overwrite an existing file with `content` (insiders, in
 * scope). The body is validated by the catalog.
 */
export const fileWriteHandlers: HandlersFor<'fileWrite'> = {
  fileWrite: async ({ params, body }, request) => {
    requireInsider(request);

    const reqPath = params['*'];
    // Defence in depth: the access hook also enforces scopes.
    requireInScope(request, reqPath);

    const resolved = fsPathOf(reqPath, getRoots(getConfig().roots));

    const stat = await fs.promises.stat(resolved).catch(() => null);
    if (!stat) throw new NotFound('File not found');
    if (!stat.isFile()) throw new NotAFile('Can only write to files');

    const { content } = body;
    // Under the per-file lock block mutations take (Decision 15), so a
    // full-file write (undo/redo) can't interleave with a block edit. A
    // write failure is a logged, masked 500 (the cause names the path).
    await withFileLock(resolved, () =>
      fs.promises.writeFile(resolved, content, 'utf8'),
    );
    return ok({
      ok: true as const,
      path: resolved,
      size: Buffer.byteLength(content, 'utf8'),
    });
  },
};
