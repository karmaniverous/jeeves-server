/**
 * Diagram rendering API route.
 *
 * Handles: /api/diagram/:type/:hash
 */

import type { FastifyPluginCallback } from 'fastify';

import { ExportFailed, InvalidRequest, NotFound } from '../../api/errors.js';
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

      if (!['mermaid', 'plantuml'].includes(type))
        throw new InvalidRequest('Invalid diagram type');
      if (!/^[a-f0-9]{64}$/.test(hash))
        throw new InvalidRequest('Invalid hash');

      const entry = getDiagramSource(hash);
      if (!entry)
        throw new NotFound('Diagram source not found (may have expired)');

      const svg = await renderDiagramToSvg(type, entry.source);
      if (!svg) throw new ExportFailed('Renderer returned empty result');

      return reply
        .header('Content-Type', 'image/svg+xml')
        .header('Cache-Control', 'public, max-age=86400, immutable')
        .send(svg);
    },
  );
  done();
};
