/**
 * Jeeves Server - Main entry point
 * Fastify server for webhooks, file serving, and markdown rendering
 */

import Fastify from 'fastify';

import { getConfig } from './config/index.js';
import { aboutRoute } from './routes/about.js';
import { eventRoute } from './routes/event.js';
import { healthRoute } from './routes/health.js';
import { keysRoute } from './routes/keys.js';
import { pathRoute } from './routes/path/index.js';

async function start() {
  const config = getConfig();

  const fastify = Fastify({
    logger: true,
  });

  // Register routes
  await fastify.register(healthRoute);
  await fastify.register(aboutRoute);
  await fastify.register(keysRoute);
  await fastify.register(eventRoute);
  await fastify.register(pathRoute);

  try {
    await fastify.listen({ port: config.port, host: '0.0.0.0' });
    console.log(`Jeeves server listening on port ${String(config.port)}`);
    console.log(`Endpoints:`);
    console.log(`  POST /webhook  - Receive webhooks (path-key auth)`);
    console.log(`  GET  /path/*   - Serve files (path-key auth)`);
    console.log(`  GET  /key      - Compute path key (X-API-Key auth)`);
    console.log(`  GET  /health   - Health check (no auth)`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

void start();
