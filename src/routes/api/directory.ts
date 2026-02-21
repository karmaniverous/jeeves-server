/**
 * Directory listing API route.
 *
 * Handles: GET /api/path/*
 */

import fs from 'node:fs';
import path from 'node:path';

import type { FastifyPluginAsync } from 'fastify';

import {
  _directoryVisibleUnderScopes,
  _pathMatchesPatterns,
  _pathMatchesScopes,
} from '../../auth/keys.js';
import { getConfig } from '../../config/index.js';
import { getRoots, urlPathToFs, fsPathToUrl, breadcrumbParts } from '../../util/platform.js';
import { filterBreadcrumbsForOutsider } from '../../util/breadcrumbs.js';

// eslint-disable-next-line @typescript-eslint/require-await
export const directoryRoutes: FastifyPluginAsync = async (fastify) => {
  const roots = getRoots(getConfig().roots);

  fastify.get<{ Params: { '*': string } }>('/api/path/*', async (request, reply) => {
    const reqPath = request.params['*'];
    if (!reqPath) return reply.redirect('/api/drives');

    const fsPath = urlPathToFs(reqPath, roots);
    if (!fsPath) return reply.code(404).send({ error: 'Invalid path' });
    const resolved = path.resolve(fsPath);

    if (!fs.existsSync(resolved)) {
      return reply.code(404).send({ error: 'Not found', path: resolved });
    }

    const stats = fs.statSync(resolved);
    if (!stats.isDirectory()) {
      const ext = path.extname(resolved).toLowerCase();
      return reply.send({
        type: 'file',
        path: reqPath,
        ext,
        size: stats.size,
        mtime: stats.mtime.toISOString().split('T')[0],
      });
    }

    const isInsider = request.accessMode === 'insider';
    const insiderScopes = request.insiderScopes ?? null;

    const allEntries = fs.readdirSync(resolved, { withFileTypes: true });

    const entries = insiderScopes
      ? allEntries.filter((entry) => {
          const entryPath = path.join(resolved, entry.name);
          const entryUrlPath = fsPathToUrl(entryPath, roots);
          if (insiderScopes.deny.length > 0) {
            if (_pathMatchesPatterns(entryUrlPath, insiderScopes.deny)) return false;
          }
          if (entry.isDirectory()) {
            return _directoryVisibleUnderScopes(entryUrlPath, insiderScopes.allow);
          }
          return _pathMatchesScopes(entryUrlPath, insiderScopes);
        })
      : allEntries;

    const sorted = entries.sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

    const result = sorted.map((entry) => {
      const entryPath = path.join(resolved, entry.name);
      let size: number | null = null;
      let mtime: string | null = null;
      const ext = path.extname(entry.name).toLowerCase();
      try {
        const entryStats = fs.statSync(entryPath);
        mtime = entryStats.mtime.toISOString().split('T')[0];
        if (!entry.isDirectory()) size = entryStats.size;
      } catch { /* ignore */ }
      return { name: entry.name, type: entry.isDirectory() ? 'directory' : 'file', ext, size, mtime };
    });

    const breadcrumbs = breadcrumbParts(resolved, roots);
    const matchedPath = request.authMatchedPath ?? null;
    const filteredBreadcrumbs = filterBreadcrumbsForOutsider(breadcrumbs, isInsider, matchedPath, true);

    return reply.send({ path: reqPath, entries: result, breadcrumbs: filteredBreadcrumbs, isInsider });
  });
};
