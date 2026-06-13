/**
 * Jeeves Server - Main entry point
 * Fastify server for webhooks, file serving, and markdown rendering
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import cookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import { getBindAddress } from '@karmaniverous/jeeves';
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';

import { resolveKeyAuth, resolveSessionAuth } from './auth/resolve.js';
import { renderSignInPage } from './auth/signInPage.js';
import { getConfig, initConfig, isConfigInitialized } from './config/index.js';
import { apiRoute } from './routes/api/index.js';
import { authRoute } from './routes/auth.js';
import { registerConfigRoute } from './routes/config.js';
import { eventRoute } from './routes/event.js';
import { goRoute } from './routes/go.js';
import { keysRoute } from './routes/keys.js';
import { oauthRoute } from './routes/oauth.js';
import { pathRoute } from './routes/path/index.js';
import { staticRoutes } from './routes/static.js';
import { statusRoutes } from './routes/status.js';
import { initDiagramCache } from './services/diagramCache.js';
import { startQueueProcessor } from './services/eventQueue.js';
import { initExportCache } from './services/exportCache.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function start() {
  try {
    const config = isConfigInitialized() ? getConfig() : initConfig();

    // Logging config (not hot-reloadable — requires service restart)
    const loggerConfig: Record<string, unknown> = {
      level: config.logging?.level ?? 'info',
    };
    if (config.logging?.file) {
      loggerConfig.transport = {
        target: 'pino/file',
        options: { destination: config.logging.file, mkdir: true },
      };
    }

    const fastify = Fastify({
      logger: loggerConfig,
    });

    // Register plugins
    await fastify.register(cookie);

    // X-Robots-Tag on all responses — invisible to search engines
    fastify.addHook('onSend', async (_request, reply) => {
      void reply.header('X-Robots-Tag', 'noindex, nofollow');
    });

    // Register routes
    await fastify.register(staticRoutes);
    registerConfigRoute(fastify);
    await fastify.register(statusRoutes);
    await fastify.register(authRoute);
    await fastify.register(oauthRoute);
    await fastify.register(keysRoute);
    await fastify.register(eventRoute);
    await fastify.register(goRoute);
    await fastify.register(apiRoute);
    await fastify.register(pathRoute);

    // Serve React SPA (if built)
    // When running from source (tsx), __dirname is packages/service/src — the
    // sibling client/ dir has unbuilt source. When running from the tsc build,
    // __dirname is .../dist/src — the sibling ../client is the built output.
    // Detect source mode: __dirname ends with /src but does NOT contain /dist/.
    const normalDir = __dirname.replace(/\\/g, '/');
    const isSourceDir =
      normalDir.endsWith('/src') && !normalDir.includes('/dist/');
    const clientDir = isSourceDir
      ? path.join(__dirname, '..', 'dist', 'client')
      : path.join(__dirname, '..', 'client');
    if (fs.existsSync(clientDir)) {
      await fastify.register(fastifyStatic, {
        root: clientDir,
        prefix: '/app/',
      });

      // Auth-gated SPA fallback — serves index.html for authenticated users,
      // branded sign-in page for unauthenticated users (#214)
      const spaFallback = async (
        request: FastifyRequest,
        reply: FastifyReply,
      ) => {
        const cfg = getConfig();
        const query = request.query as {
          key?: string;
          exp?: string;
          d?: string;
          dirs?: string;
          s?: string;
        };

        // Extract the browse path from the URL for path-scoped key verification.
        // /browse/j/docs/readme.md → j/docs/readme.md
        // /browse or /browse/ → /
        const urlPath =
          request.url.split('?')[0].replace(/^\/(browse|runner)(\/|$)/, '') ||
          '/';

        const deepParams =
          query.d !== undefined && query.s !== undefined
            ? { d: query.d, dirs: query.dirs ?? '0', s: query.s }
            : undefined;
        const keyResult = resolveKeyAuth(
          cfg,
          urlPath,
          query.key,
          query.exp,
          deepParams,
        );
        const sessionResult = resolveSessionAuth(cfg, request);

        if (keyResult.valid || sessionResult.valid) {
          return reply.sendFile('index.html', clientDir);
        }

        return reply
          .type('text/html')
          .code(401)
          .send(renderSignInPage(request.url, cfg.authModes));
      };

      for (const route of [
        '/',
        '/browse',
        '/browse/*',
        '/runner',
        '/runner/*',
      ]) {
        fastify.get(route, spaFallback);
      }

      // Catch-all: serve SPA for any unmatched GET under /browse or /runner
      // (handles edge cases like dotfile paths that wildcard routes may miss)
      fastify.setNotFoundHandler(async (request, reply) => {
        if (
          request.method === 'GET' &&
          (request.url.startsWith('/browse') ||
            request.url.startsWith('/runner'))
        ) {
          return spaFallback(request, reply);
        }
        return reply.code(404).send({ error: 'Not found' });
      });
    }

    // Initialize caches
    initDiagramCache(config.diagramCachePath);
    initExportCache();

    // Start queue processor
    startQueueProcessor();

    const bindAddress = getBindAddress('server');
    await fastify.listen({ port: config.port, host: bindAddress });
    console.log(
      `Jeeves server listening on ${bindAddress}:${String(config.port)}`,
    );
    console.log(`Endpoints:`);
    console.log(`  GET  /browse/* - File browser SPA`);
    console.log(`  GET  /api/raw/*    - Raw file serving`);
    console.log(`  GET  /api/export/* - PDF/DOCX/ZIP export`);
    console.log(`  POST /event    - Event Gateway (key auth)`);
    console.log(`  GET  /key      - Compute path key (X-API-Key auth)`);
    console.log(`  GET  /status   - Server status (no auth)`);
  } catch (err) {
    console.error('Fatal startup error:', err);
    process.exit(1);
  }
}

start().catch((err: unknown) => {
  console.error('Unhandled startup error:', err);
  process.exit(1);
});
