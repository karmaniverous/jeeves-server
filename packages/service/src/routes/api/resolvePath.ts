/**
 * Resolve-path API route.
 *
 * Handles: GET /api/resolve-path?fsPath=<absolute-fs-path>
 *
 * Converts an absolute filesystem path to a server browse path and optional
 * public URL. Useful for tools and integrations that hold filesystem paths
 * but need server-addressable URLs.
 */

import type { FastifyPluginCallback } from 'fastify';

import { getConfig } from '../../config/index.js';
import { fsPathToUrl, getRoots } from '../../util/platform.js';

export const resolvePathRoutes: FastifyPluginCallback = (
  fastify,
  _opts,
  done,
) => {
  fastify.get('/resolve-path', async (request, reply) => {
    const { fsPath } = request.query as { fsPath?: string };

    if (!fsPath) {
      return reply
        .status(400)
        .send({ error: 'fsPath query parameter required' });
    }

    const config = getConfig();
    const roots = getRoots(config.roots);
    const urlPath = fsPathToUrl(fsPath, roots);

    // Strip leading slash to produce a browse path (drive-relative)
    const browsePath = urlPath.replace(/^\//, '');
    const browseUrl = '/browse/' + browsePath;

    const response: Record<string, string> = { browsePath, browseUrl };

    if (config.publicUrl) {
      const base = config.publicUrl.replace(/\/+$/, '');
      response.publicUrl = base + browseUrl;
    }

    return reply.send(response);
  });

  done();
};
