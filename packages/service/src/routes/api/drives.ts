/**
 * Drive listing API route.
 *
 * Handles: GET /api/drives
 *
 * Scoped insiders only see roots they can navigate into.
 */

import type {
  FastifyPluginCallback,
  FastifyReply,
  FastifyRequest,
} from 'fastify';

import { canNavigatePath } from '../../auth/scopeAccess.js';
import { getConfig } from '../../config/index.js';
import { getRoots } from '../../util/platform.js';

export const drivesRoutes: FastifyPluginCallback = (fastify, _opts, done) => {
  const roots = getRoots(getConfig().roots);

  fastify.get(
    '/api/drives',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const scopes = request.insiderScopes ?? null;
      const drives = roots
        .filter((r) => canNavigatePath(`/${r.id}`, scopes))
        .map((r) => ({ letter: r.id, label: r.label }));
      return reply.send(drives);
    },
  );
  done();
};
