/**
 * Public content API route — serves rendered markdown for public pages.
 *
 * Handles: GET /api/public-content/:slug
 * No authentication required.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { FastifyPluginAsync } from 'fastify';
import { packageDirectorySync } from 'package-directory';

import { parseMarkdown } from '../../services/markdown.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = packageDirectorySync({ cwd: __dirname }) ?? __dirname;

/** Allowed slug pattern — alphanumeric, hyphens, underscores only. */
const SLUG_RE = /^[\w-]+$/;

export const publicContentRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: { slug: string } }>(
    '/api/public-content/:slug',
    async (request, reply) => {
      const { slug } = request.params;

      if (!SLUG_RE.test(slug)) {
        return reply.code(400).send({ error: 'Invalid slug' });
      }

      // readme → guides/user-guide.md; everything else → content/{slug}.md
      const filePath =
        slug === 'readme'
          ? path.join(serverRoot, 'guides', 'user-guide.md')
          : path.join(serverRoot, 'content', `${slug}.md`);

      let markdown: string;
      try {
        markdown = await fs.readFile(filePath, 'utf8');
      } catch {
        return reply.code(404).send({ error: 'Not found' });
      }

      const { html, headings } = parseMarkdown(markdown, {
        linkWindowsPaths: false,
      });

      // Return FileContent-shaped response so the SPA can reuse
      // FileContentView / MarkdownView directly.
      return reply.send({
        type: 'markdown',
        content: markdown,
        html,
        headings,
        fileName: `${slug}.md`,
        breadcrumbs: [],
        isInsider: false,
      });
    },
  );
};
