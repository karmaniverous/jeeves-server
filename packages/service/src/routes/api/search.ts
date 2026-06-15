/**
 * Search API route — proxies to jeeves-watcher for semantic search.
 *
 * Handles: POST /api/search, GET /api/search/facets.
 * Insider-only. Results filtered by insider's scope.
 *
 * @packageDocumentation
 */

import { stat } from 'node:fs/promises';

import { getServiceUrl } from '@karmaniverous/jeeves';
import type { FastifyPluginCallback } from 'fastify';
import picomatch from 'picomatch';

import { getConfig } from '../../config/index.js';
import type { NormalizedScopes } from '../../config/types.js';
import { fsPathToUrl, getRoots, urlPathToFs } from '../../util/platform.js';

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
    if (request.accessMode !== 'insider') {
      return reply.code(403).send({ error: 'Insider access required' });
    }

    const config = getConfig();
    const watcherUrl = getServiceUrl('watcher');

    const { query, limit = 20, filter } = request.body;
    if (!query || typeof query !== 'string') {
      return reply.code(400).send({ error: 'query is required' });
    }

    const insiderScopes = request.insiderScopes;
    const roots = getRoots(config.roots);

    // Over-fetch to account for scope filtering
    const fetchLimit = Math.min(limit * 5, 200);

    try {
      const watcherRes = await fetch(`${watcherUrl}/search`, {
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

        const urlPath = fsPathToUrl(fp, roots);
        // fsPathToUrl returns "/drive/path"; strip leading slash for browsePath
        const browsePath = urlPath.replace(/^\//, '');

        // Check insider scope
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
    } catch (err) {
      return await reply
        .code(502)
        .send({ error: `Watcher unreachable: ${String(err)}` });
    }
  });

  // Cached facets manifest
  let facetsCache: { data: unknown; fetchedAt: number } | null = null;
  let facetsFetchPromise: Promise<unknown> | null = null;
  const FACETS_CACHE_TTL_MS = 60_000; // 1 minute

  fastify.get('/api/search/facets', async (request, reply) => {
    if (request.accessMode !== 'insider') {
      return reply.code(403).send({ error: 'Insider access required' });
    }

    const watcherUrl = getServiceUrl('watcher');

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
          const watcherRes = await fetch(`${watcherUrl}/search/facets`, {
            signal: AbortSignal.timeout(15000),
          });
          if (!watcherRes.ok) {
            throw new Error(`HTTP ${String(watcherRes.status)}`);
          }
          const data: unknown = await watcherRes.json();
          facetsCache = { data, fetchedAt: Date.now() };
          return data;
        })().finally(() => {
          facetsFetchPromise = null;
        });
      }

      const data = await facetsFetchPromise;
      return await reply.send(data);
    } catch (err) {
      return await reply.code(502).send({
        error: 'Failed to reach watcher',
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  });
  done();
};
