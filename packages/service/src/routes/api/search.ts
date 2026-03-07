/**
 * Search API route — proxies to jeeves-watcher for semantic search.
 *
 * Handles: POST /api/search
 * Insider-only. Results filtered by insider's scope.
 */

import { stat } from 'node:fs/promises';
import path from 'node:path';

import type { FastifyPluginAsync } from 'fastify';
import picomatch from 'picomatch';

import { getConfig } from '../../config/index.js';
import type { NormalizedScopes } from '../../config/types.js';

/** Check if a path passes the insider's scope rules. */
function pathAllowedByScope(
  urlPath: string,
  scopes: NormalizedScopes | null,
): boolean {
  if (!scopes) return true; // null = unrestricted
  const normalized = urlPath.toLowerCase().replace(/\/+$/, '');
  const allowMatch = picomatch(
    scopes.allow.map((p) => p.toLowerCase().replace(/\/+$/, '')),
  );
  if (!allowMatch(normalized)) return false;
  if (scopes.deny.length > 0) {
    const denyMatch = picomatch(
      scopes.deny.map((p) => p.toLowerCase().replace(/\/+$/, '')),
    );
    if (denyMatch(normalized)) return false;
  }
  return true;
}

interface WatcherResult {
  id: string;
  score: number;
  payload: {
    file_path?: string;
    chunk_text?: string;
    chunk_index?: number;
    total_chunks?: number;
    domains?: string[];
    title?: string;
    author?: string;
    participants?: string;
    content_hash?: string;
    [key: string]: unknown;
  };
}

interface GroupedResult {
  filePath: string;
  browsePath: string;
  fileName: string;
  bestScore: number;
  mtime?: string;
  domains?: string[];
  title?: string;
  author?: string;
  participants?: string;
  chunks: Array<{
    text: string;
    index: number;
    score: number;
  }>;
}

/**
 * Resolve a browse path back to a filesystem path using roots config.
 * Inverse of fsPathToBrowsePath.
 */
function browsePathToFsPath(
  browsePath: string,
  roots: Record<string, string>,
): string | null {
  const parts = browsePath.split('/');
  const label = parts[0];
  const rest = parts.slice(1).join('/');

  // Check if label matches a root
  if (roots[label]) {
    return path.join(roots[label], rest);
  }

  // Windows drive letter: j/foo/bar → J:\foo\bar
  if (/^[a-zA-Z]$/.test(label)) {
    return `${label.toUpperCase()}:\\${rest.replace(/\//g, '\\')}`;
  }

  return null;
}

/**
 * Convert an absolute filesystem path to a browse URL path.
 * Maps drive letters and root mounts back to the URL scheme.
 */
function fsPathToBrowsePath(
  fsPath: string,
  roots: Record<string, string>,
): string | null {
  const normalized = fsPath.replace(/\\/g, '/');

  // Windows drive letter: j:/foo/bar → j/foo/bar
  const driveMatch = normalized.match(/^([a-zA-Z]):\/(.*)$/);
  if (driveMatch) {
    return `${driveMatch[1].toLowerCase()}/${driveMatch[2]}`;
  }

  // Linux roots: find matching root prefix
  for (const [label, rootPath] of Object.entries(roots)) {
    const normalizedRoot = rootPath.replace(/\\/g, '/').replace(/\/$/, '');
    if (normalized.startsWith(normalizedRoot + '/')) {
      const relative = normalized.slice(normalizedRoot.length + 1);
      return `${label}/${relative}`;
    }
    if (normalized === normalizedRoot) {
      return label;
    }
  }

  return null;
}

// eslint-disable-next-line @typescript-eslint/require-await
export const searchRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{
    Body: {
      query: string;
      limit?: number;
      filter?: Record<string, unknown>;
    };
  }>('/api/search', async (request, reply) => {
    // Insider-only
    if (request.accessMode !== 'insider') {
      return reply.code(403).send({ error: 'Insider access required' });
    }

    const config = getConfig();
    if (!config.watcherUrl) {
      return reply.code(501).send({ error: 'Search not configured' });
    }

    const { query, limit = 20, filter } = request.body;
    if (!query || typeof query !== 'string') {
      return reply.code(400).send({ error: 'query is required' });
    }

    const insiderScopes = request.insiderScopes;
    const roots = config.roots ?? {};

    // Over-fetch to account for scope filtering
    const fetchLimit = Math.min(limit * 5, 200);

    try {
      const watcherRes = await fetch(`${config.watcherUrl}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, limit: fetchLimit, filter }),
      });

      if (!watcherRes.ok) {
        const msg = await watcherRes.text().catch(() => '');
        return await reply
          .code(502)
          .send({ error: `Watcher search failed: ${msg}` });
      }

      const rawResults = (await watcherRes.json()) as WatcherResult[];

      // Filter by insider scope and map paths
      const permitted: Array<WatcherResult & { browsePath: string }> = [];
      for (const r of rawResults) {
        const fp = r.payload.file_path;
        if (!fp) continue;

        const browsePath = fsPathToBrowsePath(fp, roots);
        if (!browsePath) continue;

        // Check insider scope
        const urlPath = `/${browsePath}`;
        if (!pathAllowedByScope(urlPath, insiderScopes ?? null)) continue;

        permitted.push({ ...r, browsePath });
      }

      // Group by file path, take top `limit` files
      const fileMap = new Map<string, GroupedResult>();
      for (const r of permitted) {
        const key = r.browsePath;
        let group = fileMap.get(key);
        if (!group) {
          const parts = key.split('/');
          group = {
            filePath: r.payload.file_path ?? key,
            browsePath: key,
            fileName: parts[parts.length - 1],
            bestScore: r.score,
            domains: Array.isArray(r.payload.domains)
              ? r.payload.domains
              : r.payload.domain
                ? [r.payload.domain as string]
                : [],
            title: r.payload.title,
            author: r.payload.author,
            participants: r.payload.participants,
            chunks: [],
          };
          fileMap.set(key, group);
        }
        if (r.score > group.bestScore) group.bestScore = r.score;
        group.chunks.push({
          text: r.payload.chunk_text ?? '',
          index: r.payload.chunk_index ?? 0,
          score: r.score,
        });
      }

      // Sort by best score, limit
      const grouped = [...fileMap.values()]
        .sort((a, b) => b.bestScore - a.bestScore)
        .slice(0, limit);

      // Sort chunks within each group by index, and fetch mtime
      await Promise.all(
        grouped.map(async (g) => {
          g.chunks.sort((a, b) => a.index - b.index);
          const fsPath = browsePathToFsPath(g.browsePath, roots);
          if (fsPath) {
            try {
              const s = await stat(fsPath);
              g.mtime = s.mtime.toISOString();
            } catch {
              /* file may not be accessible */
            }
          }
        }),
      );

      // Extract distinct metadata values for filter chips
      const metadata = {
        domains: [
          ...new Set(grouped.flatMap((g) => g.domains || []).filter(Boolean)),
        ],
        authors: [...new Set(grouped.map((g) => g.author).filter(Boolean))],
        participants: [
          ...new Set(
            grouped.flatMap((g) => {
              try {
                const p = JSON.parse(g.participants ?? '[]') as string[];
                return Array.isArray(p) ? p : [];
              } catch {
                return g.participants ? [g.participants] : [];
              }
            }),
          ),
        ].filter(Boolean),
      };

      return await reply.send({ results: grouped, metadata });
    } catch (err) {
      return await reply
        .code(502)
        .send({ error: `Watcher unreachable: ${String(err)}` });
    }
  });

  // Cached facets manifest
  let facetsCache: { data: unknown; fetchedAt: number } | null = null;
  const FACETS_CACHE_TTL_MS = 60_000; // 1 minute

  fastify.get('/api/search/facets', async (request, reply) => {
    if (request.accessMode !== 'insider') {
      return reply.code(403).send({ error: 'Insider access required' });
    }

    const config = getConfig();
    if (!config.watcherUrl) {
      return reply.code(501).send({ error: 'Search not configured' });
    }

    // Return cached if fresh
    if (
      facetsCache &&
      Date.now() - facetsCache.fetchedAt < FACETS_CACHE_TTL_MS
    ) {
      return reply.send(facetsCache.data);
    }

    try {
      const watcherRes = await fetch(`${config.watcherUrl}/search/facets`, {
        signal: AbortSignal.timeout(5000),
      });

      if (!watcherRes.ok) {
        return await reply
          .code(watcherRes.status)
          .send({ error: 'Watcher facets request failed' });
      }

      const data: unknown = await watcherRes.json();
      facetsCache = { data, fetchedAt: Date.now() };
      return await reply.send(data);
    } catch (err) {
      return await reply.code(502).send({
        error: 'Failed to reach watcher',
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  });
};
