/**
 * Unified file mutation endpoint: edit-block, delete-block, insert-block,
 * edit-cell, toggle-checkbox (`fileMutationActions.ts`). Insider-only, .md
 * files only, under the per-file lock.
 */

import type { FastifyPluginAsync } from 'fastify';

import { InvalidRequest } from '../../api/errors.js';
import { getConfig } from '../../config/index.js';
import { withFileLock } from '../../util/fileMutex.js';
import { getRoots } from '../../util/platform.js';
import { applyMutation, type MutationBody } from './fileMutationActions.js';
import { fsPathOf, requirePath } from './routePath.js';
import { requireInScope, requireInsider } from './scopeGuard.js';

export const fileMutationRoutes: FastifyPluginAsync = (fastify) => {
  const roots = getRoots(getConfig().roots);

  fastify.post<{
    Params: { '*': string };
    Body: MutationBody;
  }>('/api/file/*', async (request, reply) => {
    requireInsider(request);
    const reqPath = requirePath(request.params['*']);

    // Defence in depth: the auth middleware also enforces scopes.
    requireInScope(request, reqPath);

    if (!reqPath.endsWith('.md'))
      throw new InvalidRequest('Only .md files are supported');

    const resolved = fsPathOf(reqPath, roots);

    const body = request.body as MutationBody | undefined;
    if (!body || typeof body.action !== 'string')
      throw new InvalidRequest('Missing action field');

    await withFileLock(resolved, () => applyMutation(resolved, body));
    return reply.send({ ok: true });
  });

  return Promise.resolve();
};
