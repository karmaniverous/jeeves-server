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

import { getConfig } from './config/index.js';
import { aboutRoute } from './routes/about.js';
import { apiRoute } from './routes/api.js';
import { authRoute } from './routes/auth.js';
import { eventRoute } from './routes/event.js';
import { healthRoute } from './routes/health.js';
import { keysRoute } from './routes/keys.js';
import { pathRoute } from './routes/path/index.js';
import { startQueueProcessor } from './services/eventQueue.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function start() {
  try {
    const config = getConfig();

    const fastify = Fastify({
      logger: true,
    });

    // Register plugins
    await fastify.register(cookie);

    // Favicon
    fastify.get('/favicon.svg', async (_request, reply) => {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="0.9em" font-size="90">🎩</text></svg>`;
      reply.type('image/svg+xml').send(svg);
    });

    // Serve Lucide locally
    fastify.get('/static/lucide.min.js', async (_request, reply) => {
      const lucidePath = path.join(__dirname, '..', 'node_modules', 'lucide', 'dist', 'umd', 'lucide.min.js');
      return reply.type('application/javascript').send(fs.readFileSync(lucidePath));
    });

    // Serve Panzoom locally
    fastify.get('/static/panzoom.min.js', async (_request, reply) => {
      const pzPath = path.join(__dirname, '..', 'node_modules', '@panzoom', 'panzoom', 'dist', 'panzoom.min.js');
      return reply.type('application/javascript').send(fs.readFileSync(pzPath));
    });

    // Serve highlight.js themes locally
    fastify.get('/static/hljs/:theme', async (request, reply) => {
      const { theme } = request.params as { theme: string };
      if (!/^[\w-]+\.min\.css$/.test(theme)) {
        return reply.code(404).send('Not found');
      }
      const themePath = path.join(__dirname, '..', 'node_modules', 'highlight.js', 'styles', theme);
      if (!fs.existsSync(themePath)) {
        return reply.code(404).send('Not found');
      }
      return reply.type('text/css').send(fs.readFileSync(themePath));
    });

    // Register routes
    await fastify.register(healthRoute);
    await fastify.register(aboutRoute);
    await fastify.register(authRoute);
    await fastify.register(keysRoute);
    await fastify.register(eventRoute);
    await fastify.register(apiRoute);
    await fastify.register(pathRoute);

    // Serve React SPA (if built)
    const clientDir = path.join(__dirname, 'client');
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
    }

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
