/**
 * Health check endpoint
 */

import type { FastifyPluginAsync } from 'fastify';

export const healthRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/health', async () => {
    return { ok: true, uptime: process.uptime() };
  });
};
