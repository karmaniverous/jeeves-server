/**
 * Jeeves Server - Main entry point
 * Fastify server for webhooks, file serving, and markdown rendering
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import cookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import Fastify from 'fastify';

import { getConfig, initConfig } from './config/index.js';
import { apiRoute } from './routes/api/index.js';
import { authRoute } from './routes/auth.js';
import { eventRoute } from './routes/event.js';
import { healthRoute } from './routes/health.js';
import { keysRoute } from './routes/keys.js';
import { pathRoute } from './routes/path/index.js';
import { staticRoutes } from './routes/static.js';
import { initDiagramCache } from './services/diagramCache.js';
import { startQueueProcessor } from './services/eventQueue.js';
import { initExportCache } from './services/exportCache.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function start() {
  try {
    // If config is already initialized (e.g. by CLI), use it; otherwise init from default search
    let config;
    try {
      config = getConfig();
    } catch {
      config = await initConfig();
    }

    const fastify = Fastify({
      logger: true,
    });

    // Register plugins
    await fastify.register(cookie);

    // X-Robots-Tag on all responses — invisible to search engines
    fastify.addHook('onSend', async (_request, reply) => {
      void reply.header('X-Robots-Tag', 'noindex, nofollow');
    });

    // Register routes
    await fastify.register(staticRoutes);
    await fastify.register(healthRoute);
    await fastify.register(authRoute);
    await fastify.register(keysRoute);
    await fastify.register(eventRoute);
    await fastify.register(apiRoute);
    await fastify.register(pathRoute);

    // Serve React SPA (if built)
    const clientDir = path.join(__dirname, '..', 'client');
    if (fs.existsSync(clientDir)) {
      await fastify.register(fastifyStatic, {
        root: clientDir,
        prefix: '/app/',
      });

      // SPA fallback for React routes
      fastify.get('/', async (_request, reply) => {
        return reply.sendFile('index.html', clientDir);
      });
      fastify.get('/browse', async (_request, reply) => {
        return reply.sendFile('index.html', clientDir);
      });
      fastify.get('/browse/*', async (_request, reply) => {
        return reply.sendFile('index.html', clientDir);
      });
      fastify.get('/runner', async (_request, reply) => {
        return reply.sendFile('index.html', clientDir);
      });
      fastify.get('/runner/*', async (_request, reply) => {
        return reply.sendFile('index.html', clientDir);
      });
    }

    // Initialize caches
    initDiagramCache(config.diagramCachePath);
    initExportCache();

    // Start queue processor
    startQueueProcessor();

    await fastify.listen({ port: config.port, host: '0.0.0.0' });
    console.log(`Jeeves server listening on port ${String(config.port)}`);
    console.log(`Endpoints:`);
    console.log(`  GET  /browse/* - File browser SPA`);
    console.log(`  GET  /api/raw/*    - Raw file serving`);
    console.log(`  GET  /api/export/* - PDF/DOCX/ZIP export`);
    console.log(`  POST /event    - Event Gateway (key auth)`);
    console.log(`  GET  /key      - Compute path key (X-API-Key auth)`);
    console.log(`  GET  /health   - Health check (no auth)`);
  } catch (err) {
    console.error('Fatal startup error:', err);
    process.exit(1);
  }
}

start().catch((err: unknown) => {
  console.error('Unhandled startup error:', err);
  process.exit(1);
});
