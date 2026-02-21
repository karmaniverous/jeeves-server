/**
 * JSON API endpoints for the React frontend
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';

import {
  _directoryVisibleUnderScopes,
  _pathMatchesPatterns,
  _pathMatchesScopes,
  verifyKey,
} from '../auth/keys.js';
import archiver from 'archiver';
import { computeDeepShareKey, computeInsiderKey, computeOutsiderKeyWithExpiry, computePathKey, timingSafeEqual } from '../util/crypto.js';
import { COOKIE_NAME, verifySessionCookie } from '../auth/session.js';
import { getConfig, resetConfig } from '../config/index.js';
import { setInsiderKey } from '../util/state.js';
import type { AccessMode, NormalizedScopes } from '../config/types.js';
import { getRoots, urlPathToFs, fsPathToUrl, breadcrumbParts, type RootEntry } from '../util/platform.js';
import { execSync } from 'node:child_process';
import { type ExportFormat, exportPage } from '../services/export.js';
import { appendEvent } from '../services/eventQueue.js';

import hljs from 'highlight.js';

import { rewriteLinksForDeepShare } from '../services/deepShareLinks.js';
import { renderEmbeddedDiagrams, setDiagramContext, getDiagramSource, renderDiagramToSvg, diagramHash } from '../services/embeddedDiagrams.js';
import { parseMarkdown } from '../services/markdown.js';
import { getCachedDiagram, cacheDiagram, getCachedDiagramBuffer, cacheDiagramBuffer } from '../services/diagramCache.js';
import { renderPlantUmlSvg, renderPlantUmlToBuffer, getPlantUmlFormats } from '../services/plantuml.js';
import { getContentType, isInlineType, looksLikeText } from '../util/fileDetection.js';
import { formatRelativeTime } from '../util/formatters.js';

interface Breadcrumb {
  label: string;
  path: string;
}

// Platform roots — initialized when routes are registered
let _roots: RootEntry[] = [];

/**
 * Filter breadcrumbs for outsiders:
 * - File shares: no breadcrumbs (the page stands alone)
 * - Directory shares: trim to the share root (matchedPath)
 */
function filterBreadcrumbsForOutsider(
  breadcrumbs: Breadcrumb[],
  isInsider: boolean,
  matchedPath: string | null,
  isDirectoryView: boolean,
): Breadcrumb[] {
  if (isInsider) return breadcrumbs;
  if (!isDirectoryView) return breadcrumbs.length > 0 ? [breadcrumbs[breadcrumbs.length - 1]] : [];
  // For directory views, trim breadcrumbs to the matched (shared) path root
  if (matchedPath) {
    const normalizedMatch = matchedPath.replace(/^\/+|\/+$/g, '').toLowerCase();
    const matchIdx = breadcrumbs.findIndex(
      b => b.path.replace(/^\/+|\/+$/g, '').toLowerCase() === normalizedMatch,
    );
    if (matchIdx >= 0) return breadcrumbs.slice(matchIdx);
  }
  return breadcrumbs;
}

// eslint-disable-next-line @typescript-eslint/require-await
export const apiRoute: FastifyPluginAsync = async (fastify) => {
  // Initialize platform roots and mermaid command from config
  const config = getConfig();
  _roots = getRoots(config.roots);
  const mmcdPrefix = config.mermaidCliPath ? `npx --prefix ${config.mermaidCliPath}` : 'npx';
  const mmcdCmd = `${mmcdPrefix} mmdc`;

  // API authentication middleware
  fastify.addHook('preHandler', async (request, reply) => {
    if (!request.url.startsWith('/api')) return;
    if (request.url.startsWith('/api/readme-link')) return;
    if (request.url.startsWith('/api/auth/status')) return;
    // Utility endpoints handle their own scope checking (path is in body, not URL)
    if (request.url.startsWith('/api/util/')) {
      // Still need auth, but skip scope-based path verification
      const config = getConfig();
      const query = request.query as { key?: string; exp?: string };
      const provided = query.key;

      // Try key auth (insider key, no path scope check)
      if (provided) {
        const result = verifyKey(config.resolvedKeys, '/', provided, query.exp, config.resolvedInsiders);
        if (result.valid && result.mode === 'insider') {
          (request as { accessMode?: AccessMode }).accessMode = 'insider';
          (request as { authSeed?: string }).authSeed = result.seed!;
          (request as { insiderScopes?: NormalizedScopes | null }).insiderScopes =
            config.resolvedKeys.find(k => k.seed === result.seed)?.scopes ?? null;
          return;
        }
        // Check insider keys
        for (const ri of config.resolvedInsiders) {
          if (!ri.seed) continue;
          const insiderKey = computeInsiderKey(ri.seed);
          if (timingSafeEqual(provided, insiderKey)) {
            (request as { accessMode?: AccessMode }).accessMode = 'insider';
            (request as { authSeed?: string }).authSeed = ri.seed;
            (request as { insiderScopes?: NormalizedScopes | null }).insiderScopes = ri.scopes;
            (request as { insiderEmail?: string }).insiderEmail = ri.email;
            return;
          }
        }
      }

      // Try session auth
      const sessionSecret = config.sessionSecret;
      if (sessionSecret) {
        const cookieValue = (request.cookies as Record<string, string> | undefined)?.[COOKIE_NAME];
        if (cookieValue) {
          const session = verifySessionCookie(cookieValue, sessionSecret);
          if (session) {
            const insider = config.resolvedInsiders.find(
              (i) => i.email.toLowerCase() === session.email.toLowerCase(),
            );
            if (insider?.seed) {
              (request as { accessMode?: AccessMode }).accessMode = 'insider';
              (request as { authSeed?: string }).authSeed = insider.seed;
              (request as { insiderScopes?: NormalizedScopes | null }).insiderScopes = insider.scopes;
              (request as { insiderEmail?: string }).insiderEmail = insider.email;
              return;
            }
          }
        }
      }

      reply.code(401).send({ error: 'Insider auth required for utility endpoints' });
      return;
    }

    const config = getConfig();
    const query = request.query as { key?: string; exp?: string; d?: string; dirs?: string; s?: string };
    const provided = query.key;
    const expParam = query.exp;
    const deepParams = query.d !== undefined && query.s !== undefined
      ? { d: query.d!, dirs: query.dirs ?? '0', s: query.s! }
      : undefined;

    // Determine URL path for scope checking
    const urlPath = request.url
      .split('?')[0]
      .replace('/api/path', '')
      .replace('/api/drives', '/')
      .replace('/api/file', '')
      .replace('/api/raw', '')
      .replace('/api/export', '');

    // Try API key auth
    let authResult = verifyKey(
      config.resolvedKeys,
      urlPath || '/',
      provided,
      expParam,
      config.resolvedInsiders,
      deepParams,
    );

    // For directory requests with dirs=1, the key was derived for a file path
    // (the last entry in the stack), not the directory path. Verify against the
    // stack's last entry and allow if the directory is an ancestor/sibling.
    if (!authResult.valid && deepParams && deepParams.dirs === '1' && provided) {
      const { decodeStack } = await import('../services/deepShareLinks.js');
      const stack = decodeStack(deepParams.s);
      const lastStackEntry = stack[stack.length - 1];
      if (lastStackEntry && lastStackEntry !== urlPath) {
        authResult = verifyKey(
          config.resolvedKeys,
          lastStackEntry,
          provided,
          expParam,
          config.resolvedInsiders,
          deepParams,
        );
        // dirs=true grants unrestricted directory access,
        // scoped only by the sharer's own permissions.
      }
    }

    if (authResult.valid) {
      (request as { accessMode?: AccessMode }).accessMode =
        authResult.mode ?? undefined;
      (request as { authSeed?: string }).authSeed =
        authResult.seed ?? undefined;
      (request as { deepShareParams?: typeof deepParams }).deepShareParams =
        deepParams;
      (request as { authMatchedPath?: string | null }).authMatchedPath =
        authResult.matchedPath;
      return;
    }

    // Try session cookie auth
    const sessionSecret = config.sessionSecret;
    if (sessionSecret) {
      const cookieValue = (
        request.cookies as Record<string, string> | undefined
      )?.[COOKIE_NAME];
      if (cookieValue) {
        const session = verifySessionCookie(cookieValue, sessionSecret);
        if (session) {
          const insider = config.resolvedInsiders.find(
            (i) => i.email.toLowerCase() === session.email.toLowerCase(),
          );
          if (insider?.seed) {
            (request as { accessMode?: AccessMode }).accessMode = 'insider';
            (request as { authSeed?: string }).authSeed = insider.seed;
            (request as { insiderEmail?: string }).insiderEmail = insider.email;
            (request as { insiderScopes?: NormalizedScopes | null }).insiderScopes =
              insider.scopes ?? null;
            (request as { keyAge?: string | null }).keyAge =
              insider.keyCreatedAt
                ? formatRelativeTime(insider.keyCreatedAt)
                : null;
            return;
          }
        }
      }
    }

    reply.code(401).send({ error: 'Unauthorized' });
    return;
  });

  // GET /api/drives — list accessible filesystem roots
  fastify.get(
    '/api/drives',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const drives = _roots.map(r => ({ letter: r.id, label: r.label }));
      return reply.send(drives);
    },
  );

  // GET /api/path/* — directory listing as JSON
  fastify.get<{ Params: { '*': string } }>(
    '/api/path/*',
    async (request, reply) => {
      const reqPath = request.params['*'];
      if (!reqPath) return reply.redirect('/api/drives');

      // Convert URL path to filesystem path
      const fsPath = urlPathToFs(reqPath, _roots);
      if (!fsPath) {
        return reply.code(404).send({ error: 'Invalid path' });
      }
      const resolved = path.resolve(fsPath);

      if (!fs.existsSync(resolved)) {
        return reply.code(404).send({ error: 'Not found', path: resolved });
      }

      const stats = fs.statSync(resolved);
      if (!stats.isDirectory()) {
        // It's a file — return file metadata
        const ext = path.extname(resolved).toLowerCase();
        return reply.send({
          type: 'file',
          path: reqPath,
          ext,
          size: stats.size,
          mtime: stats.mtime.toISOString().split('T')[0],
        });
      }

      const isInsider =
        (request as { accessMode?: AccessMode }).accessMode === 'insider';
      const insiderScopes =
        (request as { insiderScopes?: NormalizedScopes | null }).insiderScopes ?? null;

      const allEntries = fs.readdirSync(resolved, { withFileTypes: true });

      // Filter by scopes (allow/deny)
      const entries = insiderScopes
        ? allEntries.filter((entry) => {
            const entryPath = path.join(resolved, entry.name);
            const entryUrlPath = fsPathToUrl(entryPath, _roots);

            // Check deny first — if denied, always hide
            if (insiderScopes.deny.length > 0) {
              if (_pathMatchesPatterns(entryUrlPath, insiderScopes.deny)) return false;
            }

            // For directories, check if any allowed scope is under or above this directory
            if (entry.isDirectory()) {
              return _directoryVisibleUnderScopes(entryUrlPath, insiderScopes.allow);
            }
            return _pathMatchesScopes(entryUrlPath, insiderScopes);
          })
        : allEntries;

      // Sort: directories first, then alphabetically
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
          if (!entry.isDirectory()) {
            size = entryStats.size;
          }
        } catch {
          // ignore
        }

        return {
          name: entry.name,
          type: entry.isDirectory() ? 'directory' : 'file',
          ext,
          size,
          mtime,
        };
      });

      // Build breadcrumbs
      const breadcrumbs = breadcrumbParts(resolved, _roots);
      const matchedPath = (request as { authMatchedPath?: string | null }).authMatchedPath ?? null;
      const filteredBreadcrumbs = filterBreadcrumbsForOutsider(breadcrumbs, isInsider, matchedPath, true);

      return reply.send({
        path: reqPath,
        entries: result,
        breadcrumbs: filteredBreadcrumbs,
        isInsider,
      });
    },
  );

  // GET /api/file/* — file content as JSON
  // ?raw=1 returns only raw content (skips server-side rendering/highlighting)
  fastify.get<{ Params: { '*': string }; Querystring: { raw?: string } }>(
    '/api/file/*',
    async (request, reply) => {
      const rawOnly = request.query.raw === '1';
      const reqPath = request.params['*'];
      if (!reqPath) return reply.code(400).send({ error: 'Path required' });

      // Convert URL path to filesystem path
      const fsFilePath = urlPathToFs(reqPath, _roots);
      if (!fsFilePath) {
        return reply.code(404).send({ error: 'Invalid path' });
      }
      const resolved = path.resolve(fsFilePath);

      if (!fs.existsSync(resolved)) {
        return reply.code(404).send({ error: 'Not found' });
      }

      const stats = fs.statSync(resolved);
      if (stats.isDirectory()) {
        return reply
          .code(400)
          .send({ error: 'Use /api/path/ for directories' });
      }

      const ext = path.extname(resolved).toLowerCase();
      const fileName = path.basename(resolved);
      const isInsider =
        (request as { accessMode?: AccessMode }).accessMode === 'insider';

      // Build breadcrumbs
      const matchedPath = (request as { authMatchedPath?: string | null }).authMatchedPath ?? null;
      const breadcrumbs = filterBreadcrumbsForOutsider(
        breadcrumbParts(resolved, _roots),
        isInsider,
        matchedPath,
        false, // file view, not directory
      );

      // Markdown
      if (ext === '.md') {
        const markdown = fs.readFileSync(resolved, 'utf8');
        if (rawOnly) {
          return reply.send({ type: 'markdown', content: markdown, fileName, breadcrumbs, isInsider });
        }
        const urlDir = reqPath.includes('/') ? reqPath.substring(0, reqPath.lastIndexOf('/')) : '';
        const fsDir = path.dirname(resolved);
        setDiagramContext(fsDir);
        let { html, headings } = parseMarkdown(markdown, {
          linkWindowsPaths: true,
          basePath: urlDir,
        });

        // For export (render_diagrams=1), render embedded diagrams server-side.
        // Otherwise, leave lazy placeholders for client-side loading.
        if ((request.query as { render_diagrams?: string }).render_diagrams === '1') {
          html = await renderEmbeddedDiagrams(html, fsDir);
        }

        // Deep share link rewriting for outsiders with depth > 0
        const deepShare = (request as { deepShareParams?: { d: string; dirs: string; s: string } }).deepShareParams;
        const seed = (request as { authSeed?: string }).authSeed;
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

      // Mermaid — render to SVG server-side via mmdc (with cache)
      if (ext === '.mmd') {
        const content = fs.readFileSync(resolved, 'utf8');
        if (rawOnly) {
          return reply.send({ type: 'mermaid', content, fileName, breadcrumbs, isInsider });
        }
        let renderedSvg: string | null = getCachedDiagram('mermaid', content);
        if (!renderedSvg) {
          try {
            const tmpOut = path.join(
              path.dirname(resolved),
              `.${path.basename(resolved, '.mmd')}.tmp.svg`,
            );
            execSync(
              `${mmcdCmd} -i "${resolved}" -o "${tmpOut}" -w 1600 -s 2 -b white -p puppeteer.json`,
              { timeout: 30_000, stdio: 'pipe' },
            );
            if (fs.existsSync(tmpOut)) {
              renderedSvg = fs.readFileSync(tmpOut, 'utf8');
              fs.unlinkSync(tmpOut);
            }
          } catch {
            // Fall back to raw content only
          }
          if (renderedSvg) cacheDiagram('mermaid', content, renderedSvg);
        }
        return reply.send({
          type: 'mermaid',
          content,
          html: renderedSvg,
          fileName,
          breadcrumbs,
          isInsider,
        });
      }

      // PlantUML — render to SVG via jar or server fallback (with cache)
      if (ext === '.puml' || ext === '.plantuml' || ext === '.pu') {
        const content = fs.readFileSync(resolved, 'utf8');
        if (rawOnly) {
          return reply.send({ type: 'plantuml', content, fileName, breadcrumbs, isInsider });
        }
        let renderedSvg: string | null = getCachedDiagram('plantuml', content);
        if (!renderedSvg) {
          try {
            renderedSvg = await renderPlantUmlSvg(resolved);
          } catch {
            // Fall back to raw content only
          }
          if (renderedSvg) cacheDiagram('plantuml', content, renderedSvg);
        }
        return reply.send({
          type: 'plantuml',
          content,
          html: renderedSvg,
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

      // Text files (check content)
      const buffer = fs.readFileSync(resolved);
      if (looksLikeText(buffer)) {
        const textContent = buffer.toString('utf8');
        if (rawOnly) {
          return reply.send({ type: 'text', content: textContent, fileName, breadcrumbs, isInsider });
        }
        // Server-side syntax highlighting
        let highlightedHtml: string | null = null;
        let detectedLang: string | null = null;
        const extLangMap: Record<string, string> = {
          '.js': 'javascript', '.mjs': 'javascript', '.cjs': 'javascript',
          '.ts': 'typescript', '.mts': 'typescript', '.tsx': 'typescript', '.jsx': 'javascript',
          '.json': 'json', '.jsonl': 'json',
          '.yaml': 'yaml', '.yml': 'yaml',
          '.xml': 'xml', '.html': 'xml', '.htm': 'xml',
          '.css': 'css', '.scss': 'scss', '.less': 'less',
          '.py': 'python', '.rb': 'ruby', '.go': 'go', '.rs': 'rust',
          '.java': 'java', '.c': 'c', '.cpp': 'cpp', '.h': 'c', '.hpp': 'cpp',
          '.cs': 'csharp', '.sh': 'bash', '.bash': 'bash', '.zsh': 'bash',
          '.ps1': 'powershell', '.bat': 'dos', '.cmd': 'dos',
          '.sql': 'sql', '.md': 'markdown', '.ini': 'ini', '.toml': 'ini',
          '.graphql': 'graphql', '.gql': 'graphql',
          '.swift': 'swift', '.kt': 'kotlin', '.lua': 'lua',
          '.php': 'php', '.r': 'r', '.pl': 'perl',
        };
        try {
          const knownLang = extLangMap[ext];
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
        } catch {
          // Fall back to unhighlighted
        }
        return reply.send({
          type: 'text',
          content: textContent,
          html: highlightedHtml,
          language: detectedLang,
          fileName,
          breadcrumbs,
          isInsider,
        });
      }

      // Images
      const imageExts = [
        '.png',
        '.jpg',
        '.jpeg',
        '.gif',
        '.webp',
        '.bmp',
        '.ico',
      ];
      if (imageExts.includes(ext)) {
        return reply.send({
          type: 'image',
          fileName,
          breadcrumbs,
          isInsider,
        });
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

  // ── Raw file serving ────────────────────────────────────────────────

  // GET /api/raw/* — serve raw file bytes (replaces /path/X?raw=1)
  fastify.get<{ Params: { '*': string } }>(
    '/api/raw/*',
    async (request, reply) => {
      const reqPath = request.params['*'];
      if (!reqPath) return reply.code(400).send({ error: 'Path required' });

      const _rawFsPath = urlPathToFs(reqPath, _roots);
      if (!_rawFsPath) return reply.code(404).send({ error: 'Invalid path' });
      const resolved = path.resolve(_rawFsPath);

      if (!fs.existsSync(resolved)) {
        return reply.code(404).send({ error: 'Not found', path: resolved });
      }

      const stats = fs.statSync(resolved);
      if (stats.isDirectory()) {
        return reply.code(400).send({ error: 'Cannot serve directory as raw — use /api/export for ZIP' });
      }

      const ext = path.extname(resolved).toLowerCase();
      const contentType = getContentType(ext);
      reply.header('Content-Type', contentType);

      if (!isInlineType(contentType)) {
        reply.header(
          'Content-Disposition',
          `attachment; filename="${path.basename(resolved)}"`,
        );
      }

      return reply.send(fs.readFileSync(resolved));
    },
  );

  // ── Export endpoints ───────────────────────────────────────────────

  /**
   * Recursively calculate total size of a directory in bytes
   */
  function getDirSize(dirPath: string): number {
    let totalSize = 0;
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const entryPath = path.join(dirPath, entry.name);
        try {
          if (entry.isDirectory()) {
            totalSize += getDirSize(entryPath);
          } else {
            const s = fs.statSync(entryPath);
            totalSize += s.size;
          }
        } catch { /* skip inaccessible */ }
      }
    } catch { /* skip inaccessible */ }
    return totalSize;
  }

  // GET /api/export/* — export files (PDF, DOCX, ZIP)
  fastify.get<{ Params: { '*': string }; Querystring: { format?: string } }>(
    '/api/export/*',
    async (request, reply) => {
      const reqPath = request.params['*'];
      if (!reqPath) return reply.code(400).send({ error: 'Path required' });

      const _exportFsPath = urlPathToFs(reqPath, _roots);
      if (!_exportFsPath) return reply.code(404).send({ error: 'Invalid path' });
      const resolved = path.resolve(_exportFsPath);

      if (!fs.existsSync(resolved)) {
        return reply.code(404).send({ error: 'Not found', path: resolved });
      }

      const format = request.query.format ?? 'pdf';
      const stats = fs.statSync(resolved);

      // ZIP export for directories
      if (stats.isDirectory()) {
        if (format !== 'zip') {
          return reply.code(400).send({ error: 'Directories only support ZIP export' });
        }
        const isInsider = (request as { accessMode?: AccessMode }).accessMode === 'insider';
        if (!isInsider) {
          return reply.code(403).send({ error: 'ZIP export requires insider access' });
        }
        const config = getConfig();
        const totalSize = getDirSize(resolved);
        const maxSizeBytes = config.maxZipSizeMb * 1024 * 1024;
        if (totalSize > maxSizeBytes) {
          return reply.code(413).send({
            error: `Directory too large for ZIP export (${Math.round(totalSize / 1024 / 1024)}MB, max ${config.maxZipSizeMb}MB)`,
          });
        }
        const dirName = path.basename(resolved);
        const archive = archiver('zip', { zlib: { level: 6 } });
        reply.header('Content-Type', 'application/zip');
        reply.header('Content-Disposition', `attachment; filename="${dirName}.zip"`);
        reply.send(archive);
        archive.directory(resolved, dirName);
        void archive.finalize();
        return;
      }

      // PDF/DOCX export for files
      if (format !== 'pdf' && format !== 'docx') {
        return reply.code(400).send({ error: 'Files support pdf or docx export' });
      }

      const ext = path.extname(resolved).toLowerCase();
      if (ext !== '.md') {
        return reply.code(400).send({ error: 'Only markdown files support PDF/DOCX export' });
      }

      const internalKey = getConfig().internalInsiderKey;
      const { port } = getConfig();
      const exportKey = (request.query as { key?: string }).key || internalKey;
      if (!exportKey) {
        return reply.code(500).send({ error: 'Export unavailable — no internal key configured' });
      }

      // Navigate Puppeteer to the SPA browse page for rendering
      // render_diagrams=1 tells the API to inline diagrams server-side for export
      const exportUrl = `http://localhost:${String(port)}/browse/${reqPath}?key=${exportKey}&render_diagrams=1`;
      const fileName = path.basename(resolved);
      const baseName = fileName.replace(/\.md$/i, '');

      try {
        const buffer = await exportPage({
          url: exportUrl,
          fileName,
          format: format as ExportFormat,
        });

        const contentType = format === 'pdf'
          ? 'application/pdf'
          : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        const fileExt = format === 'pdf' ? 'pdf' : 'docx';

        return reply
          .header('Content-Type', contentType)
          .header('Content-Disposition', `attachment; filename="${baseName}.${fileExt}"`)
          .header('Content-Length', buffer.length)
          .send(buffer);
      } catch (err) {
        appendEvent({ kind: `${format}_export_error`, error: String(err) });
        return reply.code(500).send({
          error: `${format.toUpperCase()} export failed`,
          details: String(err),
        });
      }
    },
  );

  // GET /api/readme-link — pre-computed outsider share link for the server's README (no auth required)
  fastify.get('/api/readme-link', async (_request, reply) => {
    const config = getConfig();
    // Use the _internal key seed for the README share link
    const internalKey = config.resolvedKeys.find(k => k.name === '_internal');
    if (!internalKey?.seed) {
      return reply.code(503).send({ error: 'No _internal key configured' });
    }
    const seed = internalKey.seed;

    // Compute the README's URL path from the server's install directory
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const serverRoot = path.resolve(__dirname, '..', '..');
    const readmePath = path.join(serverRoot, 'README.md');
    if (!fs.existsSync(readmePath)) {
      return reply.code(404).send({ error: 'README.md not found' });
    }

    // Convert filesystem path to URL path
    const urlPath = fsPathToUrl(readmePath, _roots);

    // Generate deep share link with depth=2, dirs=false
    const { encodeStack } = await import('../services/deepShareLinks.js');
    const stack = encodeStack([urlPath]);
    const deepParams = { depth: 2, dirs: false, stack, exp: undefined };
    const key = computeDeepShareKey(seed, urlPath, deepParams);
    const shareUrl = `/browse${urlPath}?key=${key}&d=2&dirs=0&s=${stack}`;

    return reply.send({ url: shareUrl });
  });

  // POST /api/share — generate outsider share link (cookie auth only, no keys on client)
  fastify.post<{ Body: { path: string; expiry?: string; depth?: number; dirs?: boolean } }>(
    '/api/share',
    async (request, reply) => {
      const seed = (request as { authSeed?: string }).authSeed;
      if (!seed) {
        return reply.code(401).send({ error: 'Insider auth required' });
      }

      const { path: targetPath, expiry, depth, dirs } = request.body;
      if (!targetPath) {
        return reply.code(400).send({ error: 'path is required' });
      }

      let outsiderKey: string;
      let shareUrl: string;

      // Deep share (depth > 0 or dirs enabled)
      if ((depth && depth > 0) || dirs) {
        const { encodeStack } = await import('../services/deepShareLinks.js');
        const stack = encodeStack([targetPath]);
        const deepParams: import('../util/crypto.js').DeepShareParams = {
          depth: depth ?? 0,
          dirs: dirs ?? false,
          stack,
          exp: expiry,
        };
        outsiderKey = computeDeepShareKey(seed, targetPath, deepParams);
        shareUrl = `/browse${targetPath}?key=${outsiderKey}&d=${String(depth ?? 0)}&dirs=${dirs ? '1' : '0'}&s=${stack}`;
        if (expiry) shareUrl += `&exp=${expiry}`;
      } else if (expiry) {
        outsiderKey = computeOutsiderKeyWithExpiry(seed, targetPath, expiry);
        shareUrl = `/browse${targetPath}?key=${outsiderKey}&exp=${expiry}`;
      } else {
        outsiderKey = computePathKey(seed, targetPath);
        shareUrl = `/browse${targetPath}?key=${outsiderKey}`;
      }

      return reply.send({ url: shareUrl, path: targetPath, exp: expiry ?? null, depth: depth ?? 0, dirs: dirs ?? false });
    },
  );

  // GET /api/diagram/:type/:hash.svg — lazy diagram rendering endpoint
  fastify.get<{ Params: { type: string; hash: string } }>(
    '/api/diagram/:type/:hash',
    async (request, reply) => {
      const { type, hash: hashWithExt } = request.params;
      const hash = hashWithExt.replace(/\.svg$/, '');

      if (!['mermaid', 'plantuml'].includes(type)) {
        return reply.code(400).send({ error: 'Invalid diagram type' });
      }
      if (!/^[a-f0-9]{64}$/.test(hash)) {
        return reply.code(400).send({ error: 'Invalid hash' });
      }

      // Look up registered source
      const entry = getDiagramSource(hash);
      if (!entry) {
        // Source not in memory — check if it's in the cache anyway
        // (The cache uses the same hash, so we can serve directly)
        const { getCachedDiagram: getFromCache } = await import('../services/diagramCache.js');
        // We can't look up by hash alone since the cache key is computed from type+source.
        // If the source isn't registered, we can't serve it.
        return reply.code(404).send({ error: 'Diagram source not found (may have expired)' });
      }

      const svg = await renderDiagramToSvg(type, entry.source, entry.contextDir);
      if (!svg) {
        return reply.code(500).send({ error: `${type} render failed` });
      }

      return reply
        .header('Content-Type', 'image/svg+xml')
        .header('Cache-Control', 'public, max-age=86400, immutable')
        .send(svg);
    },
  );

  // GET /api/mermaid-export/* — render .mmd file to SVG or PNG
  fastify.get<{ Params: { '*': string }; Querystring: { format?: string } }>(
    '/api/mermaid-export/*',
    async (request, reply) => {
      const reqPath = request.params['*'];
      if (!reqPath) return reply.code(400).send({ error: 'Path required' });

      const _mmdFsPath = urlPathToFs(reqPath, _roots);
      if (!_mmdFsPath) return reply.code(404).send({ error: 'Invalid path' });
      const resolved = path.resolve(_mmdFsPath);

      if (!fs.existsSync(resolved) || !resolved.toLowerCase().endsWith('.mmd')) {
        return reply.code(404).send({ error: 'Mermaid file not found' });
      }

      const mermaidFormats = ['svg', 'png', 'pdf'];
      const format = mermaidFormats.includes(request.query.format ?? '') ? request.query.format! : 'svg';
      const source = fs.readFileSync(resolved, 'utf8');

      // Check cache first
      const cachedBuffer = getCachedDiagramBuffer('mermaid', source, format);
      if (cachedBuffer) {
        const contentTypes: Record<string, string> = { svg: 'image/svg+xml', png: 'image/png', pdf: 'application/pdf' };
        const downloadName = `${path.basename(resolved, '.mmd')}.${format}`;
        return reply
          .header('Content-Type', contentTypes[format] ?? 'application/octet-stream')
          .header('Content-Disposition', `attachment; filename="${downloadName}"`)
          .send(cachedBuffer);
      }

      const outFile = path.join(
        path.dirname(resolved),
        `${path.basename(resolved, '.mmd')}.${format}`,
      );

      // Render using mermaid CLI
      try {
        execSync(
          `${mmcdCmd} -i "${resolved}" -o "${outFile}" -w 1600 -s 2 -b white -p puppeteer.json`,
          { timeout: 30_000, stdio: 'pipe' },
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Mermaid render failed';
        return reply.code(500).send({ error: message });
      }

      if (!fs.existsSync(outFile)) {
        return reply.code(500).send({ error: 'Render output not found' });
      }

      const content = fs.readFileSync(outFile);
      cacheDiagramBuffer('mermaid', source, content, format);

      const contentTypes: Record<string, string> = {
        svg: 'image/svg+xml',
        png: 'image/png',
        pdf: 'application/pdf',
      };
      const contentType = contentTypes[format] ?? 'application/octet-stream';
      const downloadName = path.basename(outFile);

      return reply
        .header('Content-Type', contentType)
        .header('Content-Disposition', `attachment; filename="${downloadName}"`)
        .send(content);
    },
  );

  // GET /api/plantuml-export/* — render .puml file to any supported format
  fastify.get<{ Params: { '*': string }; Querystring: { format?: string } }>(
    '/api/plantuml-export/*',
    async (request, reply) => {
      const reqPath = request.params['*'];
      if (!reqPath) return reply.code(400).send({ error: 'Path required' });

      const _pumlFsPath = urlPathToFs(reqPath, _roots);
      if (!_pumlFsPath) return reply.code(404).send({ error: 'Invalid path' });
      const resolved = path.resolve(_pumlFsPath);

      const ext = path.extname(resolved).toLowerCase();
      if (!fs.existsSync(resolved) || !['.puml', '.plantuml', '.pu'].includes(ext)) {
        return reply.code(404).send({ error: 'PlantUML file not found' });
      }

      const supported = getPlantUmlFormats();
      const format = supported.includes(request.query.format ?? '') ? request.query.format! : 'svg';
      const source = fs.readFileSync(resolved, 'utf8');

      // Check cache first
      const cachedBuffer = getCachedDiagramBuffer('plantuml', source, format);
      if (cachedBuffer) {
        const baseName = path.basename(resolved, ext);
        const contentTypes: Record<string, string> = { svg: 'image/svg+xml', png: 'image/png', pdf: 'application/pdf', eps: 'application/postscript' };
        return reply
          .header('Content-Type', contentTypes[format] ?? 'application/octet-stream')
          .header('Content-Disposition', `attachment; filename="${baseName}.${format}"`)
          .send(cachedBuffer);
      }

      const buffer = await renderPlantUmlToBuffer(resolved, format);

      if (!buffer) {
        return reply.code(500).send({ error: 'PlantUML render failed' });
      }

      cacheDiagramBuffer('plantuml', source, buffer, format);
      const baseName = path.basename(resolved, ext);
      const contentTypes: Record<string, string> = {
        svg: 'image/svg+xml',
        png: 'image/png',
        pdf: 'application/pdf',
        eps: 'application/postscript',
        txt: 'text/plain; charset=utf-8',
        latex: 'application/x-latex',
      };

      return reply
        .header('Content-Type', contentTypes[format] ?? 'application/octet-stream')
        .header('Content-Disposition', `attachment; filename="${baseName}.${format}"`)
        .send(buffer);
    },
  );

  // POST /api/rotate-key — rotate the insider's key (uses preHandler auth)
  fastify.post(
    '/api/rotate-key',
    async (request, reply) => {
      const insiderEmail = (request as { insiderEmail?: string }).insiderEmail;
      if (!insiderEmail) {
        return reply.code(403).send({ error: 'Insider auth required' });
      }
      const config = getConfig();
      const insider = config.resolvedInsiders.find(
        (i) => i.email.toLowerCase() === insiderEmail.toLowerCase(),
      );
      if (!insider) {
        return reply.code(403).send({ error: 'Not an insider' });
      }

      // Generate new key
      const newSeed = crypto.randomBytes(32).toString('hex');
      const now = new Date().toISOString();

      // Persist to state.json
      setInsiderKey(insider.email, newSeed, now);
      resetConfig();
      
      return reply.send({
        ok: true,
        keyCreatedAt: now,
      });
    },
  );

  // POST /api/util/share-for — audience-aware share link generation
  fastify.post<{
    Body: {
      path: string;
      insiders: string[];
      depth?: number;
      dirs?: boolean;
      enforceOutsiderPolicy?: boolean;
    };
  }>(
    '/api/util/share-for',
    async (request, reply) => {
      const config = getConfig();

      // 1. Identify sharer from auth context
      const sharerSeed = (request as { authSeed?: string }).authSeed;
      const sharerScopes = (request as { insiderScopes?: NormalizedScopes | null }).insiderScopes ?? null;
      if (!sharerSeed) {
        return reply.code(401).send({ error: 'Authentication required' });
      }

      const { path: targetPath, insiders: audienceIds, depth, dirs, enforceOutsiderPolicy } = request.body;
      if (!targetPath) return reply.code(400).send({ error: 'path is required' });
      if (!audienceIds || !Array.isArray(audienceIds)) return reply.code(400).send({ error: 'insiders array is required' });

      // 2. Can the sharer access this path?
      if (sharerScopes && !_pathMatchesScopes(targetPath, sharerScopes)) {
        return reply.send({
          url: null,
          type: 'blocked',
          reason: 'Sharer does not have access to this path',
          blocked: [],
        });
      }

      // 3. Check each audience member
      const blockedInsiders: string[] = [];
      const unknownIds: string[] = []; // Not found in insiders map → outsiders

      for (const id of audienceIds) {
        const insider = config.resolvedInsiders.find(
          (ri) => ri.email.toLowerCase() === id.toLowerCase(),
        );
        if (!insider || !insider.seed) {
          unknownIds.push(id);
          continue;
        }
        // Insider exists — check their scopes against the path
        if (insider.scopes && !_pathMatchesScopes(targetPath, insider.scopes)) {
          blockedInsiders.push(id);
        }
      }

      // If any insider is blocked, return null
      if (blockedInsiders.length > 0) {
        return reply.send({
          url: null,
          type: 'blocked',
          reason: `Insider(s) do not have access to this path`,
          blocked: blockedInsiders,
        });
      }

      // 4. Determine link type
      const hasOutsiders = unknownIds.length > 0;

      if (!hasOutsiders) {
        // All audience members are insiders with access → bare insider URL
        const proto = request.headers['x-forwarded-proto'] || 'https';
        const host = request.headers['x-forwarded-host'] || request.headers.host;
        return reply.send({
          url: `${proto}://${host}/browse${targetPath}`,
          type: 'insider',
        });
      }

      // Has outsiders — check outsider policy
      const outsiderPolicy = config.outsiderPolicy;
      const policyEnforced = enforceOutsiderPolicy !== false; // default true

      if (outsiderPolicy && policyEnforced) {
        if (!_pathMatchesScopes(targetPath, outsiderPolicy)) {
          return reply.send({
            url: null,
            type: 'policy-denied',
            reason: 'Outsider policy does not allow sharing this path',
          });
        }
      }

      // Generate outsider share link
      const { encodeStack } = await import('../services/deepShareLinks.js');

      const shareDepth = depth ?? 0;
      const shareDirs = dirs ?? false;
      const stack = encodeStack([targetPath]);
      const deepParams: import('../util/crypto.js').DeepShareParams = {
        depth: shareDepth,
        dirs: shareDirs,
        stack,
      };

      const outsiderKey = computeDeepShareKey(sharerSeed, targetPath, deepParams);
      const proto = request.headers['x-forwarded-proto'] || 'https';
      const host = request.headers['x-forwarded-host'] || request.headers.host;

      let shareUrl = `${proto}://${host}/browse${targetPath}?key=${outsiderKey}`;
      if (shareDepth > 0) shareUrl += `&d=${shareDepth}`;
      shareUrl += `&dirs=${shareDirs ? 1 : 0}`;
      if (stack) shareUrl += `&s=${stack}`;

      const response: Record<string, unknown> = {
        url: shareUrl,
        type: 'outsider-share',
      };

      // Add warning if policy would deny but wasn't enforced
      if (outsiderPolicy && !policyEnforced && !_pathMatchesScopes(targetPath, outsiderPolicy)) {
        response.warning = 'Outsider policy would deny this path';
      }

      return reply.send(response);
    },
  );

  // PUT /api/file/* — write file content (insider-only)
  fastify.put(
    '/api/file/*',
    async (request: FastifyRequest, reply: FastifyReply) => {
      if ((request as { accessMode?: string }).accessMode !== 'insider') {
        return reply.code(403).send({ error: 'Insider access required' });
      }

      const reqPath = (request.params as { '*': string })['*'];
      const fsPath = urlPathToFs(reqPath, _roots);
      if (!fsPath) {
        return reply.code(404).send({ error: 'Invalid path' });
      }
      const resolved = path.resolve(fsPath);

      // Only allow writing to existing files (no creating new files)
      try {
        const stat = await fs.promises.stat(resolved);
        if (!stat.isFile()) {
          return reply.code(400).send({ error: 'Can only write to files' });
        }
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
    },
  );

  // GET /api/auth/status — check auth (bypasses preHandler, does its own check)
  fastify.get(
    '/api/auth/status',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const config = getConfig();
      const sessionSecret = config.sessionSecret;
      if (sessionSecret) {
        const cookieValue = (
          request.cookies as Record<string, string> | undefined
        )?.[COOKIE_NAME];
        if (cookieValue) {
          const session = verifySessionCookie(cookieValue, sessionSecret);
          if (session) {
            const insider = config.resolvedInsiders.find(
              (i) => i.email.toLowerCase() === session.email.toLowerCase(),
            );
            return reply.send({
              authenticated: true,
              email: session.email,
              picture: session.picture,
              isInsider: !!insider?.seed,
              keyCreatedAt: insider?.keyCreatedAt ?? null,
            });
          }
        }
      }
      // Check key-based auth (query param or header)
      if (config.authModes.includes('keys')) {
        const query = request.query as Record<string, string>;
        const providedKey = query.key;
        if (providedKey) {
          // For outsider deep-share keys, verify against the browsed path.
          // Deep keys are derived per-path, so '/' would never match.
          // Client sends the path as a query param.
          const verifyPath = query.path ?? '/';
          const deepParams = query.d !== undefined && query.s !== undefined
            ? { d: query.d, dirs: query.dirs ?? '0', s: query.s }
            : undefined;
          const result = verifyKey(
            config.resolvedKeys,
            verifyPath,
            providedKey,
            query.exp,
            config.resolvedInsiders,
            deepParams,
          );
          if (result.valid) {
            return reply.send({
              authenticated: true,
              email: `key:${result.keyName}`,
              isInsider: result.mode === 'insider',
              keyCreatedAt: null,
            });
          }
        }
      }

      return reply.send({
        authenticated: false,
        isInsider: false,
      });
    },
  );
};
