/**
 * File content API routes.
 *
 * Handles: GET /api/file/*, PUT /api/file/*
 */

import fs from 'node:fs';
import path from 'node:path';

import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';

import { getConfig } from '../../config/index.js';
import { rewriteLinksForDeepShare } from '../../services/deepShareLinks.js';
import { getOrRenderDiagram } from '../../services/diagramCache.js';
import {
  renderEmbeddedDiagrams,
  setDiagramContext,
} from '../../services/embeddedDiagrams.js';
import { registerDiagramHashes } from '../../services/exportCache.js';
import { parseMarkdown } from '../../services/markdown.js';
import { renderMermaidSvg } from '../../services/mermaid.js';
import { renderPlantUmlSvg } from '../../services/plantuml.js';
import { filterBreadcrumbsForOutsider } from '../../util/breadcrumbs.js';
import { looksLikeText } from '../../util/fileDetection.js';
import { breadcrumbParts, getRoots, urlPathToFs } from '../../util/platform.js';

/** Image extensions recognized for type detection. */
const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.ico'];

/** PlantUML file extensions. */
const PLANTUML_EXTS = ['.puml', '.plantuml', '.pu'];

// eslint-disable-next-line @typescript-eslint/require-await
export const fileContentRoutes: FastifyPluginAsync = async (fastify) => {
  const roots = getRoots(getConfig().roots);

  // GET /api/file/*
  fastify.get<{ Params: { '*': string }; Querystring: { raw?: string } }>(
    '/api/file/*',
    async (request, reply) => {
      const rawOnly = request.query.raw === '1';
      const reqPath = request.params['*'];
      if (!reqPath) return reply.code(400).send({ error: 'Path required' });

      const fsFilePath = urlPathToFs(reqPath, roots);
      if (!fsFilePath) return reply.code(404).send({ error: 'Invalid path' });
      const resolved = path.resolve(fsFilePath);

      if (!fs.existsSync(resolved))
        return reply.code(404).send({ error: 'Not found' });

      const stats = fs.statSync(resolved);
      if (stats.isDirectory())
        return reply
          .code(400)
          .send({ error: 'Use /api/path/ for directories' });

      const ext = path.extname(resolved).toLowerCase();
      const fileName = path.basename(resolved);
      const isInsider = request.accessMode === 'insider';
      const matchedPath = request.authMatchedPath ?? null;
      const breadcrumbs = filterBreadcrumbsForOutsider(
        breadcrumbParts(resolved, roots),
        isInsider,
        matchedPath,
        false,
      );

      // Markdown
      if (ext === '.md') {
        return handleMarkdown(
          request,
          reply,
          resolved,
          reqPath,
          rawOnly,
          fileName,
          breadcrumbs,
          isInsider,
        );
      }

      // Mermaid
      if (ext === '.mmd') {
        const content = fs.readFileSync(resolved, 'utf8');
        if (rawOnly)
          return reply.send({
            type: 'mermaid',
            content,
            fileName,
            breadcrumbs,
            isInsider,
          });
        const renderedMermaid = await getOrRenderDiagram(
          'mermaid',
          content,
          () => renderMermaidSvg(resolved),
        );
        return reply.send({
          type: 'mermaid',
          content,
          html: renderedMermaid,
          fileName,
          breadcrumbs,
          isInsider,
        });
      }

      // PlantUML
      if (PLANTUML_EXTS.includes(ext)) {
        const content = fs.readFileSync(resolved, 'utf8');
        if (rawOnly)
          return reply.send({
            type: 'plantuml',
            content,
            fileName,
            breadcrumbs,
            isInsider,
          });
        const renderedPuml = await getOrRenderDiagram('plantuml', content, () =>
          renderPlantUmlSvg(resolved),
        );
        return reply.send({
          type: 'plantuml',
          content,
          html: renderedPuml,
          fileName,
          breadcrumbs,
          isInsider,
        });
      }

      // SVG
      if (ext === '.svg') {
        const content = fs.readFileSync(resolved, 'utf8');
        return reply.send({
          type: 'svg',
          content,
          fileName,
          breadcrumbs,
          isInsider,
        });
      }

      // Text files
      const buffer = fs.readFileSync(resolved);
      if (looksLikeText(buffer)) {
        // Try watcher render for non-natively-renderable text files
        if (!rawOnly) {
          const renderResult = await tryWatcherRender(resolved);
          if (renderResult && renderResult.renderAs === 'md') {
            const { html, headings } = await renderMarkdownContent(
              renderResult.content,
              request,
              resolved,
              reqPath,
              isInsider,
            );

            return await reply.send({
              type: 'markdown',
              content: buffer.toString('utf8'),
              html,
              headings,
              fileName,
              breadcrumbs,
              isInsider,
              renderAs: renderResult.renderAs,
              matchedRules: renderResult.rules,
            });
          }
        }

        return handleText(
          reply,
          buffer,
          ext,
          rawOnly,
          fileName,
          breadcrumbs,
          isInsider,
        );
      }

      // Images
      if (IMAGE_EXTS.includes(ext)) {
        return reply.send({ type: 'image', fileName, breadcrumbs, isInsider });
      }

      // Binary
      return reply.send({
        type: 'binary',
        fileName,
        size: stats.size,
        breadcrumbs,
        isInsider,
      });
    },
  );

  // PUT /api/file/*
  fastify.put(
    '/api/file/*',
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (request.accessMode !== 'insider') {
        return reply.code(403).send({ error: 'Insider access required' });
      }

      const reqPath = (request.params as { '*': string })['*'];
      const fsPath = urlPathToFs(reqPath, roots);
      if (!fsPath) return reply.code(404).send({ error: 'Invalid path' });
      const resolved = path.resolve(fsPath);

      try {
        const stat = await fs.promises.stat(resolved);
        if (!stat.isFile())
          return await reply
            .code(400)
            .send({ error: 'Can only write to files' });
      } catch {
        return reply.code(404).send({ error: 'File not found' });
      }

      const body = request.body as { content?: string } | null;
      if (!body || typeof body.content !== 'string') {
        return reply
          .code(400)
          .send({ error: 'Request body must include "content" string' });
      }

      try {
        await fs.promises.writeFile(resolved, body.content, 'utf8');
        return await reply.send({
          ok: true,
          path: resolved,
          size: Buffer.byteLength(body.content, 'utf8'),
        });
      } catch (err) {
        return reply
          .code(500)
          .send({ error: `Write failed: ${(err as Error).message}` });
      }
    },
  );
};

/** Watcher render response shape. */
interface WatcherRenderResponse {
  renderAs: string;
  content: string;
  rules: string[];
  metadata: Record<string, unknown>;
}

/**
 * Try to render a file via the watcher's render endpoint.
 * Returns null if watcher is not configured, unreachable, or no rules match.
 */
async function tryWatcherRender(
  fsPath: string,
): Promise<WatcherRenderResponse | null> {
  const config = getConfig();
  if (!config.watcherUrl) return null;

  try {
    const res = await fetch(`${config.watcherUrl}/render`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: fsPath
          .replace(/\\/g, '/')
          .replace(/^([A-Z]):/, (_, d) => d.toLowerCase() + ':'),
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
async function renderMarkdownContent(
  markdownSource: string,
  request: FastifyRequest,
  resolved: string,
  reqPath: string,
  isInsider: boolean,
): Promise<{
  html: string;
  headings: { level: number; text: string; slug: string }[];
}> {
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
  if (!isInsider && deepShare && seed) {
    const maxDepth = parseInt(deepShare.d, 10);
    const dirs = deepShare.dirs === '1';
    const currentPath = `/${reqPath}`;
    if (!isNaN(maxDepth) && maxDepth > 0) {
      html = rewriteLinksForDeepShare(
        html,
        seed,
        currentPath,
        maxDepth,
        dirs,
        deepShare.s,
        (request.query as { exp?: string }).exp,
      );
    }
  }

  return { html, headings };
}

/** Handle markdown file content. */
async function handleMarkdown(
  request: FastifyRequest,
  reply: FastifyReply,
  resolved: string,
  reqPath: string,
  rawOnly: boolean,
  fileName: string,
  breadcrumbs: { label: string; path: string }[],
  isInsider: boolean,
) {
  const markdown = fs.readFileSync(resolved, 'utf8');
  if (rawOnly)
    return reply.send({
      type: 'markdown',
      content: markdown,
      fileName,
      breadcrumbs,
      isInsider,
    });

  const { html, headings } = await renderMarkdownContent(
    markdown,
    request,
    resolved,
    reqPath,
    isInsider,
  );

  return reply.send({
    type: 'markdown',
    content: markdown,
    html,
    headings,
    fileName,
    breadcrumbs,
    isInsider,
  });
}

/** Handle text file content with optional syntax highlighting. */
function handleText(
  reply: FastifyReply,
  buffer: Buffer,
  ext: string,
  rawOnly: boolean,
  fileName: string,
  breadcrumbs: { label: string; path: string }[],
  isInsider: boolean,
) {
  const textContent = buffer.toString('utf8');
  if (rawOnly)
    return reply.send({
      type: 'text',
      content: textContent,
      fileName,
      breadcrumbs,
      isInsider,
    });

  return reply.send({
    type: 'text',
    content: textContent,
    fileName,
    breadcrumbs,
    isInsider,
  });
}
