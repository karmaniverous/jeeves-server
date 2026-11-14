/**
 * Directory listing API route.
 *
 * Handles: GET /api/path/*
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

import type { FastifyPluginCallback } from 'fastify';

import { NotFound, Unauthorized } from '../../api/errors.js';
import { canAccessPath, canNavigatePath } from '../../auth/scopeAccess.js';
import { getConfig } from '../../config/index.js';
import {
  canListDirectory,
  computeEntryLink,
  toDeepShareContext,
} from '../../services/deepShareLinks.js';
import { filterBreadcrumbsForOutsider } from '../../util/breadcrumbs.js';
import { breadcrumbParts, fsPathToUrl, getRoots } from '../../util/platform.js';
import { fsPathOf, NOT_FOUND_MESSAGE } from './routePath.js';
import { requireInScope } from './scopeGuard.js';

/** Result shape returned by {@link mapDirectoryEntry}. */
export interface DirectoryEntryInfo {
  name: string;
  type: string;
  ext: string;
  size: number | null;
  mtime: string | null;
  itemCount: number | null;
  /**
   * Deep-share listings only: the entry's own share URL (opening it is a
   * step that consumes depth), or null when it may not be opened.
   */
  shareUrl?: string | null;
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

export const directoryRoutes: FastifyPluginCallback = (
  fastify,
  _opts,
  done,
) => {
  const roots = getRoots(getConfig().roots);

  fastify.get<{ Params: { '*': string } }>(
    '/api/path/*',
    async (request, reply) => {
      const reqPath = request.params['*'];
      if (!reqPath) return reply.redirect('/api/drives');

      const resolved = fsPathOf(reqPath, roots);
      if (!fs.existsSync(resolved)) throw new NotFound(NOT_FOUND_MESSAGE);

      const insiderScopes = request.insiderScopes ?? null;
      const stats = await fsp.stat(resolved);
      if (!stats.isDirectory()) {
        // Navigation access (ancestor of an allowed path) is not enough
        // for file metadata: the file itself must be in scope.
        requireInScope(request, reqPath);
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

      // Deep share context (outsider via a deep link). A directory reached
      // by a hop (not the shared path itself) needs dirs=1.
      const deep = request.deepShareParams;
      const seed = request.authSeed;
      const deepContext =
        !isInsider && deep && seed
          ? toDeepShareContext(deep, (request.query as { exp?: string }).exp)
          : null;
      const dirPath = `/${reqPath.replace(/\/+$/u, '')}`;
      if (deepContext && !canListDirectory(deepContext, dirPath)) {
        throw new Unauthorized('Unauthorized');
      }

      const allEntries = await fsp.readdir(resolved, {
        withFileTypes: true,
      });

      const entries = insiderScopes
        ? allEntries.filter((entry) => {
            const entryPath = path.join(resolved, entry.name);
            const entryUrlPath = fsPathToUrl(entryPath, roots);
            return entry.isDirectory()
              ? canNavigatePath(entryUrlPath, insiderScopes)
              : canAccessPath(entryUrlPath, insiderScopes);
          })
        : allEntries;

      const sorted = entries.sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
      });

      const mapped = await Promise.all(
        sorted.map((entry) => mapDirectoryEntry(entry, resolved)),
      );
      const result =
        deepContext && seed
          ? mapped.map((entry) => ({
              ...entry,
              shareUrl: computeEntryLink(
                seed,
                dirPath,
                entry.name,
                entry.type === 'directory',
                deepContext,
              ),
            }))
          : mapped;

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
  done();
};
