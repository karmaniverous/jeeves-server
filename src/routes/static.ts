/**
 * Static asset routes — serves locally-bundled libraries from node_modules.
 * Eliminates CDN dependencies for Lucide, Panzoom, and highlight.js.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { FastifyPluginAsync } from 'fastify';

import { parseMarkdown } from '../services/markdown.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// eslint-disable-next-line @typescript-eslint/require-await
export const staticRoutes: FastifyPluginAsync = async (fastify) => {
  // robots.txt — block all crawlers
  fastify.get('/robots.txt', async (_request, reply) => {
    reply.type('text/plain').send('User-agent: *\nDisallow: /\n');
  });

  // Serve content/*.md as JSON with rendered HTML (no auth — public legal docs)
  fastify.get('/api/content/:file', async (request, reply) => {
    const { file } = request.params as { file: string };
    if (!/^[\w-]+$/.test(file)) {
      return reply.code(404).send({ error: 'Not found' });
    }
    const contentDir = path.resolve(__dirname, '..', '..', 'content');
    const filePath = path.join(contentDir, `${file}.md`);
    if (!fs.existsSync(filePath)) {
      return reply.code(404).send({ error: 'Not found' });
    }
    const markdown = fs.readFileSync(filePath, 'utf8');
    const { html } = parseMarkdown(markdown, {});
    return reply.send({
      type: 'markdown',
      content: markdown,
      html,
      fileName: `${file}.md`,
      breadcrumbs: [],
      isInsider: false,
    });
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

  // highlight.js themes
  fastify.get('/static/hljs/:theme', async (request, reply) => {
    const { theme } = request.params as { theme: string };
    if (!/^[\w-]+\.min\.css$/.test(theme)) {
      return reply.code(404).send('Not found');
    }
    const themePath = path.join(
      __dirname,
      '..',
      'node_modules',
      'highlight.js',
      'styles',
      theme,
    );
    if (!fs.existsSync(themePath)) {
      return reply.code(404).send('Not found');
    }
    return reply.type('text/css').send(fs.readFileSync(themePath));
  });
};
