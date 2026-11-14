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

import { InvalidPath, InvalidRequest, NotFound } from '../../api/errors.js';
import { getConfig } from '../../config/index.js';
import { encodeUrlPath, fsPathToUrl, getRoots } from '../../util/platform.js';
import { requireInsider } from './scopeGuard.js';

export const resolvePathRoutes: FastifyPluginCallback = (
  fastify,
  _opts,
  done,
) => {
  fastify.get('/api/resolve-path', async (request, reply) => {
    // Machine key or insider only: the answer reveals the configured roots
    // and publicUrl.
    requireInsider(request);

    const { fsPath } = request.query as { fsPath?: string };
    if (!fsPath) throw new InvalidRequest('fsPath query parameter required');

    // Reject non-absolute paths
    if (!path.isAbsolute(fsPath))
      throw new InvalidPath('fsPath must be an absolute path');

    const config = getConfig();
    const roots = getRoots(config.roots);
    const urlPath = fsPathToUrl(fsPath, roots);

    // Verify the path resolved under a known root.
    // fsPathToUrl returns the input path as-is on Linux when no root matches.
    const rootIds = roots.map((r) => r.id);
    const resolved = urlPath.replace(/^\//, '').split('/')[0];
    if (!resolved || !rootIds.includes(resolved))
      throw new NotFound('Path does not fall under any configured root');

    // Strip leading slash to produce a browse path (drive-relative)
    const browsePath = urlPath.replace(/^\//, '');
    const browseUrl = '/browse/' + encodeUrlPath(browsePath);

    const response: Record<string, string> = { browsePath, browseUrl };

    if (config.publicUrl) {
      const base = config.publicUrl.replace(/\/+$/, '');
      response.publicUrl = base + browseUrl;
    }

    return reply.send(response);
  });

  done();
};
