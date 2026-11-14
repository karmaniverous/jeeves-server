/**
 * Jeeves Server - Main entry point
 * Fastify server for webhooks, file serving, and markdown rendering
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getBindAddress } from '@karmaniverous/jeeves';
import Fastify from 'fastify';

import { registerServerApp } from './app.js';
import { getConfig, initConfig, isConfigInitialized } from './config/index.js';
import { initDiagramCache } from './services/diagramCache.js';
import { initTransport } from './services/email.js';
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

    // Serve the React SPA when it is built. When running from source (tsx),
    // __dirname is packages/service/src and the sibling client/ dir has
    // unbuilt source; from the tsc build, __dirname is .../dist/src and the
    // sibling ../client is the built output. Source mode: __dirname ends
    // with /src but does NOT contain /dist/.
    const normalDir = __dirname.replace(/\\/g, '/');
    const isSourceDir =
      normalDir.endsWith('/src') && !normalDir.includes('/dist/');
    const clientDir = isSourceDir
      ? path.join(__dirname, '..', 'dist', 'client')
      : path.join(__dirname, '..', 'client');

    await registerServerApp(fastify, {
      ...(fs.existsSync(clientDir) ? { clientDir } : {}),
    });

    // Initialize email transport (if email auth is configured)
    if (config.authModes.includes('email') && config.emailAuth) {
      initTransport(config.emailAuth.smtpUrl);
    }

    // Initialize caches
    initDiagramCache(config.diagramCachePath);
    initExportCache(config.exportCachePath);

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
    console.log(`  GET  /health   - Liveness check (no auth)`);
  } catch (err) {
    console.error('Fatal startup error:', err);
    process.exit(1);
  }
}

start().catch((err: unknown) => {
  console.error('Unhandled startup error:', err);
  process.exit(1);
});
