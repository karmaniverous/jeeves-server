/**
 * API route registrar — composes all API sub-plugins.
 */

import type { FastifyPluginAsync } from 'fastify';

import { authMiddleware } from './middleware.js';
import { drivesRoutes } from './drives.js';
import { directoryRoutes } from './directory.js';
import { fileContentRoutes } from './fileContent.js';
import { rawRoutes } from './raw.js';
import { exportRoutes } from './export.js';
import { diagramsRoutes } from './diagrams.js';
import { sharingRoutes } from './sharing.js';
import { authStatusRoutes } from './auth-status.js';

export const apiRoute: FastifyPluginAsync = async (fastify) => {
  await fastify.register(authMiddleware);
  await fastify.register(drivesRoutes);
  await fastify.register(directoryRoutes);
  await fastify.register(fileContentRoutes);
  await fastify.register(rawRoutes);
  await fastify.register(exportRoutes);
  await fastify.register(diagramsRoutes);
  await fastify.register(sharingRoutes);
  await fastify.register(authStatusRoutes);
};
