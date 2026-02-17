/**
 * JSON API endpoints for the React frontend
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';

import { _pathMatchesScopes, verifyKey } from '../auth/keys.js';
import archiver from 'archiver';
import { computeDeepShareKey, computeOutsiderKeyWithExpiry, computePathKey } from '../util/crypto.js';
import { COOKIE_NAME, verifySessionCookie } from '../auth/session.js';
import { getConfig, resetConfig } from '../config/index.js';
import { setInsiderKey } from '../util/state.js';
import type { AccessMode } from '../config/types.js';
import { execSync } from 'node:child_process';
import { type ExportFormat, exportPage } from '../services/export.js';
import { appendEvent } from '../services/eventQueue.js';

import hljs from 'highlight.js';

import { rewriteLinksForDeepShare } from '../services/deepShareLinks.js';
import { parseMarkdown } from '../services/markdown.js';
import { getContentType, isInlineType, looksLikeText } from '../util/fileDetection.js';
import { formatRelativeTime } from '../util/formatters.js';

interface DriveInfo {
  letter: string;
  label: string;
}

function getDrives(): DriveInfo[] {
  const drives: DriveInfo[] = [];
  for (let code = 65; code <= 90; code++) {
    const letter = String.fromCharCode(code);
    const drivePath = `${letter}:\\`;
    try {
      fs.accessSync(drivePath, fs.constants.R_OK);
      drives.push({ letter, label: '' });
    } catch {
      // Drive not accessible
    }
  }
  return drives;
}

// eslint-disable-next-line @typescript-eslint/require-await
export const apiRoute: FastifyPluginAsync = async (fastify) => {
  // API authentication middleware
  fastify.addHook('preHandler', async (request, reply) => {
    if (!request.url.startsWith('/api')) return;
    if (request.url.startsWith('/api/readme-link')) return;
    if (request.url.startsWith('/api/auth/status')) return;

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
            (request as { insiderScopes?: string[] | null }).insiderScopes =
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

  // GET /api/drives — list accessible drives
  fastify.get(
    '/api/drives',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const drives = getDrives();
      return reply.send(drives);
    },
  );

  // GET /api/path/* — directory listing as JSON
  fastify.get<{ Params: { '*': string } }>(
    '/api/path/*',
    async (request, reply) => {
      const reqPath = request.params['*'];
      if (!reqPath) return reply.redirect('/api/drives');

      // Convert URL path to Windows path
      let filePath = reqPath;
      if (/^[a-zA-Z]$/.test(filePath)) {
        filePath = `${filePath.toUpperCase()}:\\`;
      } else if (/^[a-zA-Z]\//.test(filePath)) {
        filePath = `${filePath[0].toUpperCase()}:${filePath.slice(1)}`;
      }
      filePath = filePath.replace(/\//g, '\\');
      const resolved = path.resolve(filePath);

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
        (request as { insiderScopes?: string[] | null }).insiderScopes ?? null;

      const allEntries = fs.readdirSync(resolved, { withFileTypes: true });

      // Filter by scopes
      const entries = insiderScopes
        ? allEntries.filter((entry) => {
            const entryPath = path.join(resolved, entry.name);
            const entryUrlPath = `/${entryPath.replace(/\\/g, '/').replace(/^([A-Z]):/, (_m: string, d: string) => d.toLowerCase())}`;
            if (entry.isDirectory()) {
              return insiderScopes.some((scope) => {
                const s = scope.toLowerCase().replace(/\/+$/, '');
                const p = entryUrlPath.toLowerCase();
                return (
                  p.startsWith(s.replace(/\/\*$/, '')) ||
                  s.replace(/\/\*$/, '').startsWith(p)
                );
              });
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
      const pathParts = resolved.split('\\').filter((p) => p);
      const breadcrumbs = pathParts.map((part, i) => {
        const accumParts = pathParts.slice(0, i + 1);
        const winPath = accumParts.join('\\');
        const urlPath = winPath
          .replace(/\\/g, '/')
          .replace(/^([A-Z]):/, (_m: string, d: string) => d.toLowerCase());
        return { label: part, path: urlPath };
      });

      return reply.send({
        path: reqPath,
        entries: result,
        breadcrumbs,
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

      let filePath = reqPath;
      if (/^[a-zA-Z]\//.test(filePath)) {
        filePath = `${filePath[0].toUpperCase()}:${filePath.slice(1)}`;
      }
      filePath = filePath.replace(/\//g, '\\');
      const resolved = path.resolve(filePath);

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
      const pathParts = resolved.split('\\').filter((p) => p);
      const breadcrumbs = pathParts.map((part, i) => {
        const accumParts = pathParts.slice(0, i + 1);
        const winPath = accumParts.join('\\');
        const urlPath = winPath
          .replace(/\\/g, '/')
          .replace(/^([A-Z]):/, (_m: string, d: string) => d.toLowerCase());
        return { label: part, path: urlPath };
      });

      // Markdown
      if (ext === '.md') {
        const markdown = fs.readFileSync(resolved, 'utf8');
        if (rawOnly) {
          return reply.send({ type: 'markdown', content: markdown, fileName, breadcrumbs, isInsider });
        }
        const urlDir = reqPath.includes('/') ? reqPath.substring(0, reqPath.lastIndexOf('/')) : '';
        let { html, headings } = parseMarkdown(markdown, {
          linkWindowsPaths: true,
          basePath: urlDir,
        });

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

      // Mermaid — render to SVG server-side via mmdc
      if (ext === '.mmd') {
        const content = fs.readFileSync(resolved, 'utf8');
        if (rawOnly) {
          return reply.send({ type: 'mermaid', content, fileName, breadcrumbs, isInsider });
        }
        let renderedSvg: string | null = null;
        try {
          const tmpOut = path.join(
            path.dirname(resolved),
            `.${path.basename(resolved, '.mmd')}.tmp.svg`,
          );
          execSync(
            `npx --prefix E:\\tools\\mermaid-cli mmdc -i "${resolved}" -o "${tmpOut}" -w 1600 -s 2 -b white -p puppeteer.json`,
            { timeout: 30_000, stdio: 'pipe' },
          );
          if (fs.existsSync(tmpOut)) {
            renderedSvg = fs.readFileSync(tmpOut, 'utf8');
            fs.unlinkSync(tmpOut);
          }
        } catch {
          // Fall back to raw content only
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

      let filePath = reqPath;
      if (/^[a-zA-Z]$/.test(filePath)) {
        filePath = `${filePath.toUpperCase()}:\\`;
      } else if (/^[a-zA-Z]\//.test(filePath)) {
        filePath = `${filePath[0].toUpperCase()}:${filePath.slice(1)}`;
      }
      filePath = filePath.replace(/\//g, '\\');
      const resolved = path.resolve(filePath);

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

      let filePath = reqPath;
      if (/^[a-zA-Z]$/.test(filePath)) {
        filePath = `${filePath.toUpperCase()}:\\`;
      } else if (/^[a-zA-Z]\//.test(filePath)) {
        filePath = `${filePath[0].toUpperCase()}:${filePath.slice(1)}`;
      }
      filePath = filePath.replace(/\//g, '\\');
      const resolved = path.resolve(filePath);

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
      const exportUrl = `http://localhost:${String(port)}/browse/${reqPath}?key=${exportKey}`;
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
    // Find the first insider seed to derive the share key
    const insider = config.resolvedInsiders.find(i => i.seed);
    if (!insider?.seed) {
      return reply.code(503).send({ error: 'No insider seed available' });
    }

    // Compute the README's URL path from the server's install directory
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const serverRoot = path.resolve(__dirname, '..', '..');
    const readmePath = path.join(serverRoot, 'README.md');
    if (!fs.existsSync(readmePath)) {
      return reply.code(404).send({ error: 'README.md not found' });
    }

    // Convert Windows path to URL path: E:\foo\bar → /e/foo/bar
    const urlPath = '/' + serverRoot.replace(/\\/g, '/').replace(/^([A-Za-z]):/, (_, d: string) => d.toLowerCase()) + '/README.md';

    // Generate deep share link with depth=2, dirs=false
    const { encodeStack } = await import('../services/deepShareLinks.js');
    const stack = encodeStack([urlPath]);
    const deepParams = { depth: 2, dirs: false, stack, exp: undefined };
    const key = computeDeepShareKey(insider.seed, urlPath, deepParams);
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

  // GET /api/mermaid-export/* — render .mmd file to SVG or PNG
  fastify.get<{ Params: { '*': string }; Querystring: { format?: string } }>(
    '/api/mermaid-export/*',
    async (request, reply) => {
      const reqPath = request.params['*'];
      if (!reqPath) return reply.code(400).send({ error: 'Path required' });

      let filePath = reqPath;
      if (/^[a-zA-Z]\//.test(filePath)) {
        filePath = `${filePath[0].toUpperCase()}:${filePath.slice(1)}`;
      }
      filePath = filePath.replace(/\//g, '\\');
      const resolved = path.resolve(filePath);

      if (!fs.existsSync(resolved) || !resolved.toLowerCase().endsWith('.mmd')) {
        return reply.code(404).send({ error: 'Mermaid file not found' });
      }

      const format = request.query.format === 'png' ? 'png' : 'svg';
      const outFile = path.join(
        path.dirname(resolved),
        `${path.basename(resolved, '.mmd')}.${format}`,
      );

      // Render using mermaid CLI
      try {
        execSync(
          `npx --prefix E:\\tools\\mermaid-cli mmdc -i "${resolved}" -o "${outFile}" -w 1600 -s 2 -b white -p puppeteer.json`,
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
      const contentType = format === 'png' ? 'image/png' : 'image/svg+xml';
      const downloadName = path.basename(outFile);

      return reply
        .header('Content-Type', contentType)
        .header('Content-Disposition', `attachment; filename="${downloadName}"`)
        .send(content);
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
