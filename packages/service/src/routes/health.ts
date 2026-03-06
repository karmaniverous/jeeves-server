/**
 * Health check endpoint
 */

import type { FastifyPluginAsync } from 'fastify';

// eslint-disable-next-line @typescript-eslint/require-await
export const healthRoute: FastifyPluginAsync = async (fastify) => {
  // eslint-disable-next-line @typescript-eslint/require-await
  fastify.get('/health', async () => {
    return { ok: true, uptime: process.uptime() };
  });
};
