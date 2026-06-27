/**
 * Resolve-path API route.
 *
 * Handles: GET /api/resolve-path?fsPath=<absolute-fs-path>
 *
 * Converts an absolute filesystem path to a server browse path and optional
 * public URL. Useful for tools and integrations that hold filesystem paths
 * but need server-addressable URLs.
 */

import path from 'node:path';

import type { FastifyPluginCallback } from 'fastify';

import { getConfig } from '../../config/index.js';
import { fsPathToUrl, getRoots } from '../../util/platform.js';

export const resolvePathRoutes: FastifyPluginCallback = (
  fastify,
  _opts,
  done,
) => {
  fastify.get('/api/resolve-path', async (request, reply) => {
    const { fsPath } = request.query as { fsPath?: string };

    if (!fsPath) {
      return reply
        .status(400)
        .send({ error: 'fsPath query parameter required' });
    }

    // Reject non-absolute paths
    if (!path.isAbsolute(fsPath)) {
      return reply
        .status(400)
        .send({ error: 'fsPath must be an absolute path' });
    }

    const config = getConfig();
    const roots = getRoots(config.roots);
    const urlPath = fsPathToUrl(fsPath, roots);

    // Verify the path resolved under a known root.
    // fsPathToUrl returns the input path as-is on Linux when no root matches.
    const rootIds = roots.map((r) => r.id);
    const resolved = urlPath.replace(/^\//, '').split('/')[0];
    if (!resolved || !rootIds.includes(resolved)) {
      return reply
        .status(404)
        .send({ error: 'Path does not fall under any configured root' });
    }

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
