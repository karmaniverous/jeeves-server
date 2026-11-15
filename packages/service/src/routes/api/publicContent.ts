/**
 * Public content API route — serves rendered markdown for public pages.
 *
 * Handler: `publicContent` (GET /api/public-content/:slug), no authentication.
 *
 * @packageDocumentation
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { packageDirectorySync } from 'package-directory';

import { InvalidRequest, NotFound } from '../../api/errors.js';
import { type HandlersFor, ok } from '../../api/handlerTypes.js';
import { parseMarkdown } from '../../services/markdown.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = packageDirectorySync({ cwd: __dirname }) ?? __dirname;

/** Allowed slug pattern — alphanumeric, hyphens, underscores only. */
const SLUG_RE = /^[\w-]+$/;

/** `publicContent`: a public page's rendered Markdown (no auth). */
export const publicContentHandlers: HandlersFor<'publicContent'> = {
  publicContent: async ({ params }) => {
    const { slug } = params;

    if (!SLUG_RE.test(slug)) throw new InvalidRequest('Invalid slug');

    // readme → guides/user-guide.md; everything else → content/{slug}.md
    const filePath =
      slug === 'readme'
        ? path.join(serverRoot, 'guides', 'user-guide.md')
        : path.join(serverRoot, 'content', `${slug}.md`);

    let markdown: string;
    try {
      markdown = await fs.readFile(filePath, 'utf8');
    } catch {
      throw new NotFound('Not found');
    }

    const { html, headings } = parseMarkdown(markdown, {
      linkWindowsPaths: false,
    });

    // Return FileContent-shaped response so the SPA can reuse
    // FileContentView / MarkdownView directly.
    return ok({
      type: 'markdown' as const,
      content: markdown,
      html,
      headings,
      fileName: `${slug}.md`,
      breadcrumbs: [],
      isInsider: false as const,
    });
  },
};
