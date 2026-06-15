/**
 * Static asset routes — serves locally-bundled libraries from node_modules.
 * Eliminates CDN dependencies for Lucide, Panzoom, and highlight.js.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { FastifyPluginCallback } from 'fastify';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const staticRoutes: FastifyPluginCallback = (fastify, _opts, done) => {
  // robots.txt — block all crawlers
  fastify.get('/robots.txt', async (_request, reply) => {
    reply.type('text/plain').send('User-agent: *\nDisallow: /\n');
  });

  // Favicon
  fastify.get('/favicon.svg', async (_request, reply) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="0.9em" font-size="90">🎩</text></svg>`;
    reply.type('image/svg+xml').send(svg);
  });

  // Lucide icons
  fastify.get('/static/lucide.min.js', async (_request, reply) => {
    const filePath = path.join(
      __dirname,
      '..',
      'node_modules',
      'lucide',
      'dist',
      'umd',
      'lucide.min.js',
    );
    return reply.type('application/javascript').send(fs.readFileSync(filePath));
  });

  // Panzoom
  fastify.get('/static/panzoom.min.js', async (_request, reply) => {
    const filePath = path.join(
      __dirname,
      '..',
      'node_modules',
      '@panzoom',
      'panzoom',
      'dist',
      'panzoom.min.js',
    );
    return reply.type('application/javascript').send(fs.readFileSync(filePath));
  });
  done();
};
