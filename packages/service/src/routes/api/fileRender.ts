/**
 * Markdown rendering for the file content API: parses Markdown to HTML,
 * registers diagram hashes, optionally renders embedded diagrams and
 * rewrites links for outsider shares.
 *
 * @packageDocumentation
 */

import type { FastifyRequest } from 'fastify';

import { isDirectoryUrlPath } from '../../services/contentPath.js';
import {
  rewriteLinksForDeepShare,
  rewriteSimpleImageAuth,
} from '../../services/deepShareLinks.js';
import { toDeepShareContext } from '../../services/deepShareStack.js';
import { renderEmbeddedDiagrams } from '../../services/embeddedDiagrams.js';
import { registerDiagramHashes } from '../../services/exportCache.js';
import { parseMarkdown } from '../../services/markdown.js';

/** Rendered Markdown: HTML plus heading outline. */
export interface RenderedMarkdown {
  html: string;
  headings: { level: number; text: string; slug: string }[];
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
    html = await renderEmbeddedDiagrams(html);
  }

  const deepShare = request.deepShareParams;
  const seed = request.authSeed;
  if (!isInsider && seed) {
    if (deepShare) {
      const context = toDeepShareContext(
        deepShare,
        (request.query as { exp?: string }).exp,
      );
      html = rewriteLinksForDeepShare(
        html,
        seed,
        `/${reqPath}`,
        context.maxDepth,
        context.dirs,
        context.stackCompressed,
        context.exp,
        isDirectoryUrlPath,
      );
    } else {
      html = rewriteSimpleImageAuth(html, seed);
    }
  }

  return { html, headings };
}
