/**
 * Path endpoint - file serving with markdown rendering, directory listings, etc.
 *
 * TODO: This is a large route that needs to be completed.
 * Core features:
 * - Directory listings with breadcrumbs
 * - Markdown rendering with TOC, Windows path linking, syntax highlighting
 * - SVG inlining for panzoom support
 * - Code file syntax highlighting
 * - Binary file serving
 * - PDF/DOCX export
 * - Insider/outsider access modes
 */

import type { FastifyPluginAsync } from 'fastify';

import { verifyKey } from '../auth/keys.js';
import { getConfig } from '../config/index.js';
import { appendEvent } from '../services/eventQueue.js';

export const pathRoute: FastifyPluginAsync = async (fastify) => {
  // Path authentication middleware
  fastify.addHook('preHandler', async (request, reply) => {
    if (!request.url.startsWith('/path')) return;

    const urlPath = request.url.split('?')[0].replace('/path', '');
    const provided = (request.query as { key?: string }).key;
    const expParam = (request.query as { exp?: string }).exp;
    const config = getConfig();

    const authResult = verifyKey(config.apiKey, urlPath, provided, expParam);

    if (!authResult.valid) {
      appendEvent({ kind: 'auth_failed_path', ip: request.ip, path: urlPath });
      reply.code(401).send({ error: 'Unauthorized' });
      return;
    }

    // Store access mode on request for use in rendering
    (request as { accessMode?: string }).accessMode =
      authResult.mode ?? undefined;
  });

  // Root path: list all drives
  fastify.get('/path', async (request, reply) => {
    // TODO: Implement drive listing
    reply.send('<html><body>Drive listing not yet implemented</body></html>');
  });

  // File/directory serving
  fastify.get('/path/*', async (request, reply) => {
    // TODO: Implement full file/directory serving logic
    reply.send('<html><body>File serving not yet implemented</body></html>');
  });
};
