/**
 * Drive listing API route.
 *
 * Handles: GET /api/drives
 */

import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';

import { getConfig } from '../../config/index.js';
import { getRoots } from '../../util/platform.js';

// eslint-disable-next-line @typescript-eslint/require-await
export const drivesRoutes: FastifyPluginAsync = async (fastify) => {
  const roots = getRoots(getConfig().roots);

  fastify.get('/api/drives', async (_request: FastifyRequest, reply: FastifyReply) => {
    const drives = roots.map(r => ({ letter: r.id, label: r.label }));
    return reply.send(drives);
  });
};
