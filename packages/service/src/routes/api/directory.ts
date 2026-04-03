/**
 * Directory listing API route.
 *
 * Handles: GET /api/path/*
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

import type { FastifyPluginAsync } from 'fastify';

import {
  _directoryVisibleUnderScopes,
  _pathMatchesPatterns,
  _pathMatchesScopes,
} from '../../auth/keys.js';
import { getConfig } from '../../config/index.js';
import { filterBreadcrumbsForOutsider } from '../../util/breadcrumbs.js';
import {
  breadcrumbParts,
  fsPathToUrl,
  getRoots,
  urlPathToFs,
} from '../../util/platform.js';

/** Result shape returned by {@link mapDirectoryEntry}. */
export interface DirectoryEntryInfo {
  name: string;
  type: string;
  ext: string;
  size: number | null;
  mtime: string | null;
  itemCount: number | null;
}

/**
 * Map a single directory entry to its API representation.
 *
 * Uses async fs operations so the event loop is not blocked
 * when listing large directories.
 */
export async function mapDirectoryEntry(
  entry: fs.Dirent,
  parentDir: string,
): Promise<DirectoryEntryInfo> {
  const entryPath = path.join(parentDir, entry.name);
  let size: number | null = null;
  let mtime: string | null = null;
  let itemCount: number | null = null;
  const ext = path.extname(entry.name).toLowerCase();
  try {
    const entryStats = await fsp.stat(entryPath);
    mtime = entryStats.mtime.toISOString().split('T')[0];
    if (entry.isDirectory()) {
      try {
        const children = await fsp.readdir(entryPath);
        itemCount = children.length;
      } catch {
        /* permission denied, etc. */
      }
    } else {
      size = entryStats.size;
    }
  } catch {
    /* ignore */
  }
  return {
    name: entry.name,
    type: entry.isDirectory() ? 'directory' : 'file',
    ext,
    size,
    mtime,
    itemCount,
  };
}

// eslint-disable-next-line @typescript-eslint/require-await
export const directoryRoutes: FastifyPluginAsync = async (fastify) => {
  const roots = getRoots(getConfig().roots);

  fastify.get<{ Params: { '*': string } }>(
    '/api/path/*',
    async (request, reply) => {
      const reqPath = request.params['*'];
      if (!reqPath) return reply.redirect('/api/drives');

      const fsPath = urlPathToFs(reqPath, roots);
      if (!fsPath) return reply.code(404).send({ error: 'Invalid path' });
      const resolved = path.resolve(fsPath);

      if (!fs.existsSync(resolved)) {
        return reply.code(404).send({ error: 'Not found', path: resolved });
      }

      const stats = await fsp.stat(resolved);
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

      const allEntries = await fsp.readdir(resolved, {
        withFileTypes: true,
      });

      const entries = insiderScopes
        ? allEntries.filter((entry) => {
            const entryPath = path.join(resolved, entry.name);
            const entryUrlPath = fsPathToUrl(entryPath, roots);
            if (insiderScopes.deny.length > 0) {
              if (_pathMatchesPatterns(entryUrlPath, insiderScopes.deny))
                return false;
            }
            if (entry.isDirectory()) {
              return _directoryVisibleUnderScopes(
                entryUrlPath,
                insiderScopes.allow,
              );
            }
            return _pathMatchesScopes(entryUrlPath, insiderScopes);
          })
        : allEntries;

      const sorted = entries.sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
      });

      const result = await Promise.all(
        sorted.map((entry) => mapDirectoryEntry(entry, resolved)),
      );

      const breadcrumbs = breadcrumbParts(resolved, roots);
      const matchedPath = request.authMatchedPath ?? null;
      const filteredBreadcrumbs = filterBreadcrumbsForOutsider(
        breadcrumbs,
        isInsider,
        matchedPath,
        true,
      );

      return reply.send({
        path: reqPath,
        entries: result,
        breadcrumbs: filteredBreadcrumbs,
        isInsider,
      });
    },
  );
};
