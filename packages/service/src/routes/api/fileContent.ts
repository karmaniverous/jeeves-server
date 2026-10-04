/**
 * File content API route: returns a file's content and, where supported,
 * its rendered form (Markdown, Mermaid, PlantUML, CSV, watcher-rendered text).
 *
 * Handles: GET /api/file/* (writes: fileWrite.ts, mutations: fileMutations.ts)
 *
 * @packageDocumentation
 */

import fs from 'node:fs';
import path from 'node:path';

import type { FastifyPluginAsync } from 'fastify';

import { getConfig } from '../../config/index.js';
import { csvToHtmlTable } from '../../services/csv.js';
import { getOrRenderDiagram } from '../../services/diagramCache.js';
import { renderMermaidSvg } from '../../services/mermaid.js';
import { renderPlantUmlSvg } from '../../services/plantuml.js';
import { filterBreadcrumbsForOutsider } from '../../util/breadcrumbs.js';
import { looksLikeText } from '../../util/fileDetection.js';
import { breadcrumbParts, getRoots, urlPathToFs } from '../../util/platform.js';
import { renderMarkdownContent, tryWatcherRender } from './fileRender.js';

/** Image extensions recognized for type detection. */
const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.ico'];

/** PlantUML file extensions. */
const PLANTUML_EXTS = ['.puml', '.plantuml', '.pu'];

export const fileContentRoutes: FastifyPluginAsync = (fastify) => {
  const roots = getRoots(getConfig().roots);

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
      const isInsider = request.accessMode === 'insider';
      // Fields common to every response shape.
      const base = {
        fileName: path.basename(resolved),
        breadcrumbs: filterBreadcrumbsForOutsider(
          breadcrumbParts(resolved, roots),
          isInsider,
          request.authMatchedPath ?? null,
          false,
        ),
        isInsider,
      };

      // Markdown
      if (ext === '.md') {
        const content = fs.readFileSync(resolved, 'utf8');
        if (rawOnly) return reply.send({ type: 'markdown', content, ...base });
        const rendered = await renderMarkdownContent(
          content,
          request,
          resolved,
          reqPath,
          isInsider,
        );
        return reply.send({
          type: 'markdown',
          content,
          ...rendered,
          ...base,
          mtime: stats.mtimeMs,
        });
      }

      // Diagrams
      const diagramType =
        ext === '.mmd'
          ? 'mermaid'
          : PLANTUML_EXTS.includes(ext)
            ? 'plantuml'
            : null;
      if (diagramType) {
        const content = fs.readFileSync(resolved, 'utf8');
        if (rawOnly) return reply.send({ type: diagramType, content, ...base });
        const html = await getOrRenderDiagram(diagramType, content, () =>
          diagramType === 'mermaid'
            ? renderMermaidSvg(resolved)
            : renderPlantUmlSvg(resolved),
        );
        return reply.send({ type: diagramType, content, html, ...base });
      }

      // SVG
      if (ext === '.svg') {
        const content = fs.readFileSync(resolved, 'utf8');
        return reply.send({ type: 'svg', content, ...base });
      }

      // CSV
      if (ext === '.csv') {
        const content = fs.readFileSync(resolved, 'utf8');
        if (rawOnly) return reply.send({ type: 'text', content, ...base });
        const html = csvToHtmlTable(content);
        return reply.send({ type: 'csv', content, html, ...base });
      }

      // Text files (optionally rendered by jeeves-watcher)
      const buffer = fs.readFileSync(resolved);
      if (looksLikeText(buffer)) {
        const content = buffer.toString('utf8');
        const renderResult = rawOnly ? null : await tryWatcherRender(resolved);
        if (renderResult?.renderAs === 'md') {
          const rendered = await renderMarkdownContent(
            renderResult.content,
            request,
            resolved,
            reqPath,
            isInsider,
          );
          return reply.send({
            type: 'markdown',
            content,
            ...rendered,
            ...base,
            mtime: stats.mtimeMs,
            renderAs: renderResult.renderAs,
            matchedRules: renderResult.rules,
          });
        }
        return reply.send({ type: 'text', content, ...base });
      }

      // Images
      if (IMAGE_EXTS.includes(ext)) {
        return reply.send({ type: 'image', ...base });
      }

      // Binary
      return reply.send({ type: 'binary', size: stats.size, ...base });
    },
  );

  return Promise.resolve();
};
