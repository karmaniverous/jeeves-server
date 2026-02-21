/**
 * File browsing and serving API routes.
 *
 * Handles: /api/drives, /api/path/*, /api/file/*, /api/raw/*, PUT /api/file/*
 */

import fs from 'node:fs';
import path from 'node:path';

import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import hljs from 'highlight.js';

import {
  _directoryVisibleUnderScopes,
  _pathMatchesPatterns,
  _pathMatchesScopes,
} from '../../auth/keys.js';
import { getConfig } from '../../config/index.js';
import type { AccessMode, NormalizedScopes } from '../../config/types.js';
import { getRoots, urlPathToFs, fsPathToUrl, breadcrumbParts, type RootEntry } from '../../util/platform.js';
import { getContentType, isInlineType, looksLikeText, getLanguageForExt } from '../../util/fileDetection.js';
import { filterBreadcrumbsForOutsider } from '../../util/breadcrumbs.js';
import { getCachedDiagram, cacheDiagram } from '../../services/diagramCache.js';
import { renderPlantUmlSvg } from '../../services/plantuml.js';
import { renderMermaidSvg } from '../../services/mermaid.js';
import { rewriteLinksForDeepShare } from '../../services/deepShareLinks.js';
import { renderEmbeddedDiagrams, setDiagramContext } from '../../services/embeddedDiagrams.js';
import { parseMarkdown } from '../../services/markdown.js';

let _roots: RootEntry[] = [];

// eslint-disable-next-line @typescript-eslint/require-await
export const filesRoutes: FastifyPluginAsync = async (fastify) => {
  const config = getConfig();
  _roots = getRoots(config.roots);

  // GET /api/drives
  fastify.get('/api/drives', async (_request: FastifyRequest, reply: FastifyReply) => {
    const drives = _roots.map(r => ({ letter: r.id, label: r.label }));
    return reply.send(drives);
  });

  // GET /api/path/*
  fastify.get<{ Params: { '*': string } }>('/api/path/*', async (request, reply) => {
    const reqPath = request.params['*'];
    if (!reqPath) return reply.redirect('/api/drives');

    const fsPath = urlPathToFs(reqPath, _roots);
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
          const entryUrlPath = fsPathToUrl(entryPath, _roots);
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

    const breadcrumbs = breadcrumbParts(resolved, _roots);
    const matchedPath = request.authMatchedPath ?? null;
    const filteredBreadcrumbs = filterBreadcrumbsForOutsider(breadcrumbs, isInsider, matchedPath, true);

    return reply.send({ path: reqPath, entries: result, breadcrumbs: filteredBreadcrumbs, isInsider });
  });

  // GET /api/file/*
  fastify.get<{ Params: { '*': string }; Querystring: { raw?: string } }>('/api/file/*', async (request, reply) => {
    const rawOnly = request.query.raw === '1';
    const reqPath = request.params['*'];
    if (!reqPath) return reply.code(400).send({ error: 'Path required' });

    const fsFilePath = urlPathToFs(reqPath, _roots);
    if (!fsFilePath) return reply.code(404).send({ error: 'Invalid path' });
    const resolved = path.resolve(fsFilePath);

    if (!fs.existsSync(resolved)) return reply.code(404).send({ error: 'Not found' });

    const stats = fs.statSync(resolved);
    if (stats.isDirectory()) return reply.code(400).send({ error: 'Use /api/path/ for directories' });

    const ext = path.extname(resolved).toLowerCase();
    const fileName = path.basename(resolved);
    const isInsider = request.accessMode === 'insider';
    const matchedPath = request.authMatchedPath ?? null;
    const breadcrumbs = filterBreadcrumbsForOutsider(
      breadcrumbParts(resolved, _roots), isInsider, matchedPath, false,
    );

    // Markdown
    if (ext === '.md') {
      const markdown = fs.readFileSync(resolved, 'utf8');
      if (rawOnly) return reply.send({ type: 'markdown', content: markdown, fileName, breadcrumbs, isInsider });

      const urlDir = reqPath.includes('/') ? reqPath.substring(0, reqPath.lastIndexOf('/')) : '';
      const fsDir = path.dirname(resolved);
      setDiagramContext(fsDir);
      let { html, headings } = parseMarkdown(markdown, { linkWindowsPaths: true, basePath: urlDir });

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
            html, seed, currentPath, maxDepth, dirs, deepShare.s,
            (request.query as { exp?: string }).exp,
          );
        }
      }

      return reply.send({ type: 'markdown', content: markdown, html, headings, fileName, breadcrumbs, isInsider });
    }

    // Mermaid
    if (ext === '.mmd') {
      const content = fs.readFileSync(resolved, 'utf8');
      if (rawOnly) return reply.send({ type: 'mermaid', content, fileName, breadcrumbs, isInsider });

      let renderedSvg: string | null = getCachedDiagram('mermaid', content);
      if (!renderedSvg) {
        renderedSvg = renderMermaidSvg(resolved);
        if (renderedSvg) cacheDiagram('mermaid', content, renderedSvg);
      }
      return reply.send({ type: 'mermaid', content, html: renderedSvg, fileName, breadcrumbs, isInsider });
    }

    // PlantUML
    if (ext === '.puml' || ext === '.plantuml' || ext === '.pu') {
      const content = fs.readFileSync(resolved, 'utf8');
      if (rawOnly) return reply.send({ type: 'plantuml', content, fileName, breadcrumbs, isInsider });

      let renderedSvg: string | null = getCachedDiagram('plantuml', content);
      if (!renderedSvg) {
        try { renderedSvg = await renderPlantUmlSvg(resolved); } catch { /* fallback */ }
        if (renderedSvg) cacheDiagram('plantuml', content, renderedSvg);
      }
      return reply.send({ type: 'plantuml', content, html: renderedSvg, fileName, breadcrumbs, isInsider });
    }

    // SVG
    if (ext === '.svg') {
      const content = fs.readFileSync(resolved, 'utf8');
      return reply.send({ type: 'svg', content, fileName, breadcrumbs, isInsider });
    }

    // Text files
    const buffer = fs.readFileSync(resolved);
    if (looksLikeText(buffer)) {
      const textContent = buffer.toString('utf8');
      if (rawOnly) return reply.send({ type: 'text', content: textContent, fileName, breadcrumbs, isInsider });

      let highlightedHtml: string | null = null;
      let detectedLang: string | null = null;
      try {
        const knownLang = getLanguageForExt(ext);
        if (knownLang) {
          const result = hljs.highlight(textContent, { language: knownLang });
          highlightedHtml = result.value;
          detectedLang = knownLang;
        } else {
          const result = hljs.highlightAuto(textContent);
          if (result.relevance > 5) {
            highlightedHtml = result.value;
            detectedLang = result.language ?? null;
          }
        }
      } catch { /* fallback */ }
      return reply.send({ type: 'text', content: textContent, html: highlightedHtml, language: detectedLang, fileName, breadcrumbs, isInsider });
    }

    // Images
    const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.ico'];
    if (imageExts.includes(ext)) {
      return reply.send({ type: 'image', fileName, breadcrumbs, isInsider });
    }

    // Binary
    return reply.send({ type: 'binary', fileName, size: stats.size, breadcrumbs, isInsider });
  });

  // GET /api/raw/*
  fastify.get<{ Params: { '*': string } }>('/api/raw/*', async (request, reply) => {
    const reqPath = request.params['*'];
    if (!reqPath) return reply.code(400).send({ error: 'Path required' });

    const _rawFsPath = urlPathToFs(reqPath, _roots);
    if (!_rawFsPath) return reply.code(404).send({ error: 'Invalid path' });
    const resolved = path.resolve(_rawFsPath);

    if (!fs.existsSync(resolved)) return reply.code(404).send({ error: 'Not found', path: resolved });

    const stats = fs.statSync(resolved);
    if (stats.isDirectory()) {
      return reply.code(400).send({ error: 'Cannot serve directory as raw — use /api/export for ZIP' });
    }

    const ext = path.extname(resolved).toLowerCase();
    const contentType = getContentType(ext);
    reply.header('Content-Type', contentType);

    if (!isInlineType(contentType)) {
      reply.header('Content-Disposition', `attachment; filename="${path.basename(resolved)}"`);
    }

    return reply.send(fs.readFileSync(resolved));
  });

  // PUT /api/file/*
  fastify.put('/api/file/*', async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.accessMode !== 'insider') {
      return reply.code(403).send({ error: 'Insider access required' });
    }

    const reqPath = (request.params as { '*': string })['*'];
    const fsPath = urlPathToFs(reqPath, _roots);
    if (!fsPath) return reply.code(404).send({ error: 'Invalid path' });
    const resolved = path.resolve(fsPath);

    try {
      const stat = await fs.promises.stat(resolved);
      if (!stat.isFile()) return reply.code(400).send({ error: 'Can only write to files' });
    } catch {
      return reply.code(404).send({ error: 'File not found' });
    }

    const body = request.body as { content?: string } | null;
    if (!body || typeof body.content !== 'string') {
      return reply.code(400).send({ error: 'Request body must include "content" string' });
    }

    try {
      await fs.promises.writeFile(resolved, body.content, 'utf8');
      return reply.send({ ok: true, path: resolved, size: Buffer.byteLength(body.content, 'utf8') });
    } catch (err) {
      return reply.code(500).send({ error: `Write failed: ${(err as Error).message}` });
    }
  });
};
