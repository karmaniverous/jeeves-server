/**
 * Path endpoint - file serving with markdown rendering, directory listings, etc.
 */

import fs from 'node:fs';
import path from 'node:path';

import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';

import { _pathMatchesScopes, verifyKey } from '../../auth/keys.js';
import { COOKIE_NAME, verifySessionCookie } from '../../auth/session.js';
import { getConfig } from '../../config/index.js';
import type { AccessMode } from '../../config/types.js';
import { appendEvent } from '../../services/eventQueue.js';
import { formatRelativeTime } from '../../util/formatters.js';
import { handleDirectory } from './directory.js';
import { renderDriveListing } from './drives.js';
import { handleGenericFile } from './file.js';
import { handleMarkdown } from './markdown.js';
import { handleSVGFile } from './svg.js';

// eslint-disable-next-line @typescript-eslint/require-await
export const pathRoute: FastifyPluginAsync = async (fastify) => {
  // Path authentication middleware
  fastify.addHook('preHandler', async (request, reply) => {
    if (!request.url.startsWith('/path')) return;

    const urlPath = request.url.split('?')[0].replace('/path', '');
    const provided = (request.query as { key?: string }).key;
    const expParam = (request.query as { exp?: string }).exp;
    const config = getConfig();
    const { authModes } = config;

    // Step 1: Try key auth (if 'keys' mode is active)
    if (authModes.includes('keys')) {
      const authResult = verifyKey(
        config.resolvedKeys,
        urlPath,
        provided,
        expParam,
        config.resolvedInsiders,
      );

      if (authResult.valid) {
        (request as { accessMode?: AccessMode }).accessMode =
          authResult.mode ?? undefined;
        (request as { authSeed?: string }).authSeed =
          authResult.seed ?? undefined;
        (request as { shareRoot?: string | null }).shareRoot =
          authResult.matchedPath;
        return;
      }
    }

    // Step 2: Try Google cookie auth (if 'google' mode is active)
    if (authModes.includes('google') && config.sessionSecret) {
      const cookieValue = (
        request.cookies as Record<string, string> | undefined
      )?.[COOKIE_NAME];
      if (cookieValue) {
        const session = verifySessionCookie(cookieValue, config.sessionSecret);
        if (session) {
          const insider = config.resolvedInsiders.find(
            (i) => i.email.toLowerCase() === session.email.toLowerCase(),
          );
          if (
            insider?.seed &&
            (!insider.scopes || _pathMatchesScopes(urlPath, insider.scopes))
          ) {
            (request as { accessMode?: AccessMode }).accessMode = 'insider';
            (request as { authSeed?: string }).authSeed = insider.seed;
            (request as { insiderEmail?: string }).insiderEmail = insider.email;
            (request as { eventInScope?: boolean }).eventInScope =
              !insider.scopes || _pathMatchesScopes('/event', insider.scopes);
            (request as { keyAge?: string | null }).keyAge =
              insider.keyCreatedAt
                ? formatRelativeTime(insider.keyCreatedAt)
                : null;
            return;
          }
        }
      }
    }

    // Step 3: Auth failed — behavior depends on modes
    if (authModes.includes('google') && config.googleAuth) {
      // Redirect to Google login
      const returnTo = request.url;
      const loginUrl = `/auth/login?returnTo=${encodeURIComponent(returnTo)}`;
      reply.redirect(loginUrl);
      return;
    }

    // No Google configured — plain 401
    appendEvent({ kind: 'auth_failed_path', ip: request.ip, path: urlPath });
    reply.code(401).send({ error: 'Unauthorized' });
    return;
  });

  // Root path: list all drives
  fastify.get('/path', async (request: FastifyRequest, reply: FastifyReply) => {
    const seed = (request as { authSeed?: string }).authSeed!;
    renderDriveListing(request, reply, seed);
  });

  // File/directory serving
  fastify.get<{ Params: { '*': string } }>(
    '/path/*',
    async (request, reply) => {
      const reqPath = request.params['*'];
      if (!reqPath) {
        return reply.redirect('/path');
      }

      // Convert URL path to Windows path: d/foo/bar.md -> D:\foo\bar.md
      let filePath = reqPath;
      if (/^[a-zA-Z]$/.test(filePath)) {
        // Bare drive letter
        filePath = `${filePath.toUpperCase()}:\\`;
      } else if (/^[a-zA-Z]\//.test(filePath)) {
        filePath = `${filePath[0].toUpperCase()}:${filePath.slice(1)}`;
      }
      filePath = filePath.replace(/\//g, '\\');

      const resolved = path.resolve(filePath);
      appendEvent({
        kind: 'path_access',
        ip: request.ip,
        requested: reqPath,
        resolved,
      });

      if (!fs.existsSync(resolved)) {
        return reply
          .code(404)
          .send({ error: 'File not found', path: resolved });
      }

      const stats = fs.statSync(resolved);
      const query = request.query as {
        key: string;
        raw?: string;
        export?: string;
        exp?: string;
        toc?: string;
      };

      const seed = (request as { authSeed?: string }).authSeed!;
      const { port } = getConfig();

      if (stats.isDirectory()) {
        handleDirectory(request, reply, resolved, reqPath, query, seed);
        return;
      } else {
        return handleFile(request, reply, resolved, reqPath, query, seed, port);
      }
    },
  );

  /**
   * Handle file serving - routes to appropriate handler
   */
  async function handleFile(
    request: FastifyRequest,
    reply: FastifyReply,
    resolved: string,
    reqPath: string,
    query: {
      key: string;
      raw?: string;
      export?: string;
      exp?: string;
      toc?: string;
    },
    apiKey: string,
    serverPort: number,
  ): Promise<void> {
    const ext = path.extname(resolved).toLowerCase();

    if (ext === '.md') {
      return handleMarkdown(
        request,
        reply,
        resolved,
        reqPath,
        query,
        apiKey,
        serverPort,
      );
    } else if (ext === '.svg' && query.raw !== '1') {
      handleSVGFile(request, reply, resolved, reqPath, query, apiKey);
    } else {
      handleGenericFile(request, reply, resolved, reqPath, query, apiKey);
    }
  }
};
