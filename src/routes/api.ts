/**
 * JSON API endpoints for the React frontend
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';

import { _pathMatchesScopes, verifyKey } from '../auth/keys.js';
import { COOKIE_NAME, verifySessionCookie } from '../auth/session.js';
import { getConfig } from '../config/index.js';
import type { AccessMode } from '../config/types.js';
import { parseMarkdown } from '../services/markdown.js';
import { looksLikeText } from '../util/fileDetection.js';
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
    if (request.url.startsWith('/api/about')) return;

    const config = getConfig();
    const provided = (request.query as { key?: string }).key;
    const expParam = (request.query as { exp?: string }).exp;

    // Determine URL path for scope checking
    const urlPath = request.url
      .split('?')[0]
      .replace('/api/path', '')
      .replace('/api/drives', '/')
      .replace('/api/file', '');

    // Try API key auth
    const authResult = verifyKey(
      config.resolvedKeys,
      urlPath || '/',
      provided,
      expParam,
      config.resolvedInsiders,
    );

    if (authResult.valid) {
      (request as { accessMode?: AccessMode }).accessMode =
        authResult.mode ?? undefined;
      (request as { authSeed?: string }).authSeed =
        authResult.seed ?? undefined;
      return;
    }

    // Try session cookie auth
    const sessionSecret = config.auth?.sessionSecret;
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
  fastify.get<{ Params: { '*': string } }>(
    '/api/file/*',
    async (request, reply) => {
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
        const { html, headings } = parseMarkdown(markdown, {
          linkWindowsPaths: true,
        });
        return reply.send({
          type: 'markdown',
          html,
          headings,
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
        return reply.send({
          type: 'text',
          content: buffer.toString('utf8'),
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

  // GET /api/about — about page content (no auth required)
  fastify.get('/api/about', async (_request, reply) => {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const aboutPath = path.join(__dirname, '..', '..', 'about.md');
    if (!fs.existsSync(aboutPath)) {
      return reply.code(404).send({ error: 'About page not found' });
    }
    const markdown = fs.readFileSync(aboutPath, 'utf8');
    const { html, headings } = parseMarkdown(markdown, {
      linkWindowsPaths: false,
    });
    return reply.send({
      type: 'markdown',
      html,
      headings,
      fileName: 'about.md',
      breadcrumbs: [{ label: 'About', path: 'about' }],
      isInsider: false,
    });
  });

  // GET /api/auth/status — check auth
  fastify.get(
    '/api/auth/status',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const isInsider =
        (request as { accessMode?: AccessMode }).accessMode === 'insider';
      const email = (request as { insiderEmail?: string }).insiderEmail;
      return reply.send({
        authenticated: true,
        email,
        isInsider,
      });
    },
  );
};
