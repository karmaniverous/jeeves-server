/**
 * API route registrar — composes all API sub-plugins.
 */

import type { FastifyPluginAsync } from 'fastify';

import { authMiddleware } from './middleware.js';
import { filesRoutes } from './files.js';
import { exportRoutes } from './export.js';
import { diagramsRoutes } from './diagrams.js';
import { sharingRoutes } from './sharing.js';
import { authStatusRoutes } from './auth-status.js';

export const apiRoute: FastifyPluginAsync = async (fastify) => {
  await fastify.register(authMiddleware);
  await fastify.register(filesRoutes);
  await fastify.register(exportRoutes);
  await fastify.register(diagramsRoutes);
  await fastify.register(sharingRoutes);
  await fastify.register(authStatusRoutes);
};
