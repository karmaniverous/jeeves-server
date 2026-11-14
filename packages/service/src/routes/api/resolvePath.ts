/**
 * Resolve-path API route.
 *
 * Handler: `resolvePath` (GET /api/resolve-path?fsPath=<absolute-fs-path>).
 *
 * Converts an absolute filesystem path to a server browse path and optional
 * public URL. Useful for tools and integrations that hold filesystem paths
 * but need server-addressable URLs.
 *
 * @packageDocumentation
 */

import path from 'node:path';

import { InvalidPath, NotFound } from '../../api/errors.js';
import { type HandlersFor, ok } from '../../api/handlerTypes.js';
import { getConfig } from '../../config/index.js';
import { encodeUrlPath, fsPathToUrl, getRoots } from '../../util/platform.js';
import { requireInScope, requireInsider } from './scopeGuard.js';

/** `resolvePath`: a filesystem path's browse path and URLs. */
export const resolvePathHandlers: HandlersFor<'resolvePath'> = {
  resolvePath: ({ query }, request) => {
    // An `insider` entry: the answer reveals the configured roots and
    // publicUrl. The access hook admits identities only; this is defence in
    // depth.
    requireInsider(request);

    const { fsPath } = query;

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
    // The caller's scopes cover the path it resolves to (#301).
    requireInScope(request, browsePath);
    const browseUrl = '/browse/' + encodeUrlPath(browsePath);

    const base = config.publicUrl?.replace(/\/+$/, '');
    return Promise.resolve(
      ok({
        browsePath,
        browseUrl,
        ...(base ? { publicUrl: base + browseUrl } : {}),
      }),
    );
  },
};
