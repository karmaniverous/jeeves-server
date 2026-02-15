/**
 * Jeeves Server - Main entry point
 * Fastify server for webhooks, file serving, and markdown rendering
 */

import cookie from '@fastify/cookie';
import Fastify from 'fastify';

import { getConfig } from './config/index.js';
import { aboutRoute } from './routes/about.js';
import { authRoute } from './routes/auth.js';
import { eventRoute } from './routes/event.js';
import { healthRoute } from './routes/health.js';
import { keysRoute } from './routes/keys.js';
import { pathRoute } from './routes/path/index.js';
import { startQueueProcessor } from './services/eventQueue.js';

async function start() {
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

  // Register routes
  await fastify.register(healthRoute);
  await fastify.register(aboutRoute);
  await fastify.register(authRoute);
  await fastify.register(keysRoute);
  await fastify.register(eventRoute);
  await fastify.register(pathRoute);

  // Start queue processor
  startQueueProcessor();

  try {
    await fastify.listen({ port: config.port, host: '0.0.0.0' });
    console.log(`Jeeves server listening on port ${String(config.port)}`);
    console.log(`Endpoints:`);
    console.log(`  POST /event    - Event Gateway (key auth)`);
    console.log(`  GET  /path/*   - Serve files (key auth)`);
    console.log(`  GET  /key      - Compute path key (X-API-Key auth)`);
    console.log(`  GET  /health   - Health check (no auth)`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

void start();
