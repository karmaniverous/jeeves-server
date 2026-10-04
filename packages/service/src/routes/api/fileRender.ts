/**
 * Markdown rendering for the file content API: parses Markdown to HTML,
 * registers diagram hashes, optionally renders embedded diagrams and
 * rewrites links for outsider shares; also proxies jeeves-watcher's
 * `/render` endpoint for other text formats.
 *
 * @packageDocumentation
 */

import path from 'node:path';

import { getServiceUrl } from '@karmaniverous/jeeves';
import type { FastifyRequest } from 'fastify';

import {
  rewriteLinksForDeepShare,
  rewriteSimpleImageAuth,
} from '../../services/deepShareLinks.js';
import {
  renderEmbeddedDiagrams,
  setDiagramContext,
} from '../../services/embeddedDiagrams.js';
import { registerDiagramHashes } from '../../services/exportCache.js';
import { parseMarkdown } from '../../services/markdown.js';

/** Watcher render response shape. */
export interface WatcherRenderResponse {
  renderAs: string;
  content: string;
  rules: string[];
  metadata: Record<string, unknown>;
}

/** Rendered Markdown: HTML plus heading outline. */
export interface RenderedMarkdown {
  html: string;
  headings: { level: number; text: string; slug: string }[];
}

/**
 * Try to render a file via the watcher's render endpoint.
 * Returns null if watcher is not configured, unreachable, or no rules match.
 */
export async function tryWatcherRender(
  fsPath: string,
): Promise<WatcherRenderResponse | null> {
  const watcherUrl = getServiceUrl('watcher');

  try {
    const res = await fetch(`${watcherUrl}/render`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: fsPath
          .replace(/\\/g, '/')
          .replace(
            /^([A-Z]):/,
            (_: string, d: string) => d.toLowerCase() + ':',
          ),
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as WatcherRenderResponse;
    if (data.rules.length === 0) return null;

    return data;
  } catch (err) {
    console.warn('Watcher render failed for ' + fsPath + ':', err);
    return null;
  }
}

/**
 * Shared markdown rendering pipeline: parse → diagram hashes → optional
 * diagram rendering → optional deep share link rewriting.
 */
export async function renderMarkdownContent(
  markdownSource: string,
  request: FastifyRequest,
  resolved: string,
  reqPath: string,
  isInsider: boolean,
): Promise<RenderedMarkdown> {
  const urlDir = reqPath.includes('/')
    ? reqPath.substring(0, reqPath.lastIndexOf('/'))
    : '';
  const fsDir = path.dirname(resolved);
  setDiagramContext(fsDir);
  const { headings, html: parsedHtml } = parseMarkdown(markdownSource, {
    linkWindowsPaths: true,
    basePath: urlDir,
  });
  let html = parsedHtml;

  // Register diagram hashes for cache-clear reverse index
  const diagramHashMatches = [
    ...html.matchAll(/data-diagram-hash="([a-f0-9]{64})"/g),
  ];
  if (diagramHashMatches.length > 0) {
    registerDiagramHashes(
      resolved,
      diagramHashMatches.map((m) => m[1]),
    );
  }

  if ((request.query as { render_diagrams?: string }).render_diagrams === '1') {
    html = await renderEmbeddedDiagrams(html, fsDir);
  }

  const deepShare = request.deepShareParams;
  const seed = request.authSeed;
  if (!isInsider && seed) {
    if (deepShare) {
      const maxDepth = parseInt(deepShare.d, 10);
      html = rewriteLinksForDeepShare(
        html,
        seed,
        `/${reqPath}`,
        isNaN(maxDepth) ? 0 : maxDepth,
        deepShare.dirs === '1',
        deepShare.s,
        (request.query as { exp?: string }).exp,
      );
    } else {
      html = rewriteSimpleImageAuth(html, seed);
    }
  }

  return { html, headings };
}
