/**
 * Unified file mutation endpoint: edit-block, delete-block, insert-block,
 * edit-cell, toggle-checkbox (`fileMutationActions.ts`). Insider-only, .md
 * files only, under the per-file lock.
 *
 * @packageDocumentation
 */

import { InvalidRequest } from '../../api/errors.js';
import { type HandlersFor, ok } from '../../api/handlerTypes.js';
import { getConfig } from '../../config/index.js';
import { withFileLock } from '../../util/fileMutex.js';
import { getRoots } from '../../util/platform.js';
import { applyMutation, type MutationBody } from './fileMutationActions.js';
import { fsPathOf, requirePath } from './routePath.js';
import { requireInScope, requireInsider } from './scopeGuard.js';

/**
 * `fileMutate`: apply one block mutation to a Markdown file. The body
 * (action and its fields) is validated by the catalog.
 */
export const fileMutationHandlers: HandlersFor<'fileMutate'> = {
  fileMutate: async ({ params, body }, request) => {
    requireInsider(request);
    const reqPath = requirePath(params['*']);

    // Defence in depth: the access hook also enforces scopes.
    requireInScope(request, reqPath);

    if (!reqPath.endsWith('.md'))
      throw new InvalidRequest('Only .md files are supported');

    const resolved = fsPathOf(reqPath, getRoots(getConfig().roots));
    // The catalog's refinement checked the action's own fields.
    const mutation = body as MutationBody;
    await withFileLock(resolved, () => applyMutation(resolved, mutation));
    return ok({ ok: true as const });
  },
};
