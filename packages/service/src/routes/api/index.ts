/**
 * API route registrar — composes all API sub-plugins.
 */

import type { FastifyPluginAsync } from 'fastify';

import { authStatusRoutes } from './auth-status.js';
import { diagramExportRoutes } from './diagramExport.js';
import { diagramsRoutes } from './diagrams.js';
import { directoryRoutes } from './directory.js';
import { drivesRoutes } from './drives.js';
import { eventsRoutes } from './events.js';
import { exportRoutes } from './export.js';
import { fileContentRoutes } from './fileContent.js';
import { fileMutationRoutes } from './fileMutations.js';
import { linkInfoRoutes } from './linkInfo.js';
import { magicLinkApiRoute } from './magicLink.js';
import { addAuthMiddleware } from './middleware.js';
import { oauthApiRoutes } from './oauth.js';
import { publicContentRoute } from './publicContent.js';
import { rawRoutes } from './raw.js';
import { resolvePathRoutes } from './resolvePath.js';
import { runnerRoutes } from './runner.js';
import { searchRoutes } from './search.js';
import { sharingRoutes } from './sharing.js';

export const apiRoute: FastifyPluginAsync = async (fastify) => {
  // Add auth hook directly to this context (not as a child plugin)
  // so it applies to all routes registered below.
  addAuthMiddleware(fastify);
  await fastify.register(drivesRoutes);
  await fastify.register(directoryRoutes);
  await fastify.register(fileContentRoutes);
  await fastify.register(linkInfoRoutes);
  await fastify.register(rawRoutes);
  await fastify.register(exportRoutes);
  await fastify.register(diagramExportRoutes);
  await fastify.register(diagramsRoutes);
  await fastify.register(runnerRoutes);
  await fastify.register(searchRoutes);
  await fastify.register(sharingRoutes);
  await fastify.register(authStatusRoutes);
  await fastify.register(eventsRoutes);
  await fastify.register(fileMutationRoutes);
  await fastify.register(magicLinkApiRoute);
  await fastify.register(oauthApiRoutes);
  await fastify.register(publicContentRoute);
  await fastify.register(resolvePathRoutes);
};
