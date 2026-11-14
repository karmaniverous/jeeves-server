/**
 * Search API route — proxies to jeeves-watcher (through its SDK) for semantic search.
 *
 * Handles: POST /api/search, GET /api/search/facets.
 * Insider-only. Results filtered by insider's scope.
 *
 * @packageDocumentation
 */

import { stat } from 'node:fs/promises';

import type { FastifyPluginCallback } from 'fastify';

import {
  capArg,
  InvalidRequest,
  WatcherUnavailable,
} from '../../api/errors.js';
import { canAccessPath } from '../../auth/scopeAccess.js';
import { getConfig } from '../../config/index.js';
import {
  WATCHER_TIMEOUT_MS,
  watcherAnswered,
  watcherClient,
} from '../../services/watcher.js';
import { fsPathToUrl, getRoots, urlPathToFs } from '../../util/platform.js';
import { requireInsider } from './scopeGuard.js';

/**
 * The `SERVER_WATCHER_UNAVAILABLE` error for a failed watcher call. When
 * the watcher answered (or the SDK refused the request), the message names
 * the call and gives the SDK's message; when it wasn't reached, only that.
 * The SDK error is the `cause` (logged, never sent).
 *
 * @param call - The call, for the message (`search`, `facets`).
 * @param err - What the call threw.
 * @returns The error to throw.
 */
export function watcherFailure(call: string, err: unknown): Error {
  const message = !watcherAnswered(err)
    ? 'Watcher unreachable'
    : `Watcher ${call} failed: ${capArg(err.message)}`;
  return Object.assign(new WatcherUnavailable(message), { cause: err });
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
  metadata: Record<string, unknown>;
  chunks: Array<{
    text: string;
    index: number;
    score: number;
  }>;
}

export const searchRoutes: FastifyPluginCallback = (fastify, _opts, done) => {
  fastify.post<{
    Body: {
      query: string;
      limit?: number;
      filter?: Record<string, unknown>;
    };
  }>('/api/search', async (request, reply) => {
    // Insider-only
    requireInsider(request);

    const config = getConfig();

    const { query, limit = 20, filter } = request.body;
    if (!query || typeof query !== 'string')
      throw new InvalidRequest('query is required');

    const insiderScopes = request.insiderScopes;
    const roots = getRoots(config.roots);

    // Over-fetch to account for scope filtering
    const fetchLimit = Math.min(limit * 5, 200);

    let rawResults: WatcherResult[];
    try {
      rawResults = await watcherClient(WATCHER_TIMEOUT_MS.search).search({
        query,
        limit: fetchLimit,
        filter,
      });
    } catch (err) {
      throw watcherFailure('search', err);
    }

    // Filter by insider scope and map paths
    const permitted: Array<WatcherResult & { browsePath: string }> = [];
    for (const r of rawResults) {
      const fp = r.payload.file_path;
      if (!fp) continue;

      const urlPath = fsPathToUrl(fp, roots);
      // fsPathToUrl returns "/drive/path"; strip leading slash for browsePath
      const browsePath = urlPath.replace(/^\//, '');

      // Check insider scope
      // Same matcher as content routes (dot paths, explicit overrides).
      if (!canAccessPath(urlPath, insiderScopes ?? null)) continue;

      permitted.push({ ...r, browsePath });
    }

    // Group by file path, take top `limit` files
    const fileMap = new Map<string, GroupedResult>();
    for (const r of permitted) {
      const key = r.browsePath;
      let group = fileMap.get(key);
      if (!group) {
        const parts = key.split('/');
        // Extract all non-internal payload fields as metadata
        const meta: Record<string, unknown> = {};
        const internalKeys = new Set([
          'file_path',
          'chunk_text',
          'chunk_index',
          'total_chunks',
          'content_hash',
          'embedded_at',
        ]);
        for (const [k, v] of Object.entries(r.payload)) {
          if (internalKeys.has(k) || v == null || v === '') continue;
          // Normalize singular 'domain' to 'domains' array to match facet field name
          if (k === 'domain') {
            meta['domains'] = Array.isArray(v) ? v : [v];
          } else {
            meta[k] = v;
          }
        }
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
          metadata: meta,
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
        const fsPath = urlPathToFs(g.browsePath, roots);
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
  });

  // Cached facets manifest
  let facetsCache: { data: unknown; fetchedAt: number } | null = null;
  let facetsFetchPromise: Promise<unknown> | null = null;
  const FACETS_CACHE_TTL_MS = 60_000; // 1 minute

  fastify.get('/api/search/facets', async (request, reply) => {
    requireInsider(request);

    // Return cached if fresh
    if (
      facetsCache &&
      Date.now() - facetsCache.fetchedAt < FACETS_CACHE_TTL_MS
    ) {
      return reply.send(facetsCache.data);
    }

    try {
      // Guard against cache stampede: reuse in-flight fetch
      if (!facetsFetchPromise) {
        facetsFetchPromise = (async () => {
          const data = await watcherClient(
            WATCHER_TIMEOUT_MS.facets,
          ).listFacets({});
          facetsCache = { data, fetchedAt: Date.now() };
          return data;
        })().finally(() => {
          facetsFetchPromise = null;
        });
      }

      const data = await facetsFetchPromise;
      return await reply.send(data);
    } catch (err) {
      throw watcherFailure('facets', err);
    }
  });
  done();
};
