/**
 * Diagram rendering API route.
 *
 * Handles: /api/diagram/:type/:hash
 */

import type { FastifyPluginCallback } from 'fastify';

import {
  getDiagramSource,
  renderDiagramToSvg,
} from '../../services/embeddedDiagrams.js';

export const diagramsRoutes: FastifyPluginCallback = (fastify, _opts, done) => {
  fastify.get<{ Params: { type: string; hash: string } }>(
    '/api/diagram/:type/:hash',
    async (request, reply) => {
      const { type, hash: hashWithExt } = request.params;
      const hash = hashWithExt.replace(/\.svg$/, '');

      if (!['mermaid', 'plantuml'].includes(type)) {
        return reply.code(400).send({ error: 'Invalid diagram type' });
      }
      if (!/^[a-f0-9]{64}$/.test(hash)) {
        return reply.code(400).send({ error: 'Invalid hash' });
      }

      const entry = getDiagramSource(hash);
      if (!entry) {
        return reply
          .code(404)
          .send({ error: 'Diagram source not found (may have expired)' });
      }

      const svg = await renderDiagramToSvg(
        type,
        entry.source,
        entry.contextDir,
      );
      if (!svg) {
        return reply
          .code(500)
          .send({ error: 'Renderer returned empty result' });
      }

      return reply
        .header('Content-Type', 'image/svg+xml')
        .header('Cache-Control', 'public, max-age=86400, immutable')
        .send(svg);
    },
  );
  done();
};
