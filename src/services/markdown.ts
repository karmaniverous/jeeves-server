/**
 * Markdown rendering with TOC generation, Windows path linking, and syntax highlighting
 */

import fs from 'node:fs';
import path from 'node:path';

import { marked } from 'marked';

import { DANGEROUS_EXTENSIONS } from '../util/fileDetection.js';

export interface Heading {
  level: number;
  text: string;
  slug: string;
}

/**
 * Resolve Windows path for linking (skip dangerous executables and non-existent paths)
 */
function resolvePathForLink(winPath: string): string | null {
  // Skip templated paths
  if (winPath.includes('{') || winPath.includes('}')) return null;

  if (!fs.existsSync(winPath)) return null;

  const stats = fs.statSync(winPath);
  if (stats.isFile()) {
    const ext = path.extname(winPath).toLowerCase();
    if (DANGEROUS_EXTENSIONS.includes(ext)) return null;
  }

  return winPath;
}

/**
 * Convert Windows paths to markdown links
 */
function linkifyWindowsPaths(markdown: string): string {
  const winPathRegex = /([A-Z]):\\(?:[^\s"'`<>\\]+\\)*[^\s"'`<>\\]+/g;

  const linkifyPath = (winPath: string): string => {
    const resolved = resolvePathForLink(winPath);
    if (!resolved) return winPath;

    const urlPath = `/${resolved.replace(/\\/g, '/').replace(/^([A-Z]):/, (m, d) => d.toLowerCase())}`;
    return `[${winPath}](/path${urlPath})`;
  };

  // Split by code blocks and inline code
  const codeBlockRegex = /(```[\s\S]*?```|`[^`\n]+`)/g;
  const parts = markdown.split(codeBlockRegex);

  return parts
    .map((part) => {
      if (part.startsWith('```') || part.startsWith('`')) {
        return part; // Don't modify code
      }
      return part.replace(winPathRegex, linkifyPath);
    })
    .join('');
}

/**
 * Parse markdown to HTML with heading extraction
 */
export function parseMarkdown(
  markdown: string,
  options: { linkWindowsPaths?: boolean } = {},
): { html: string; headings: Heading[] } {
  let processedMarkdown = markdown;

  // Optionally linkify Windows paths
  if (options.linkWindowsPaths) {
    processedMarkdown = linkifyWindowsPaths(processedMarkdown);
  }

  const headings: Heading[] = [];

  // Custom renderer to extract headings and add anchors
  const renderer = new marked.Renderer();
  const originalHeading = renderer.heading.bind(renderer);

  renderer.heading = function (
    args: string | { text: string; raw?: string; depth: number },
  ) {
    const text = typeof args === 'object' ? args.text : args;
    const raw = typeof args === 'object' && args.raw ? args.raw : text;
    const level = typeof args === 'object' ? args.depth : 1;

    const slug = String(raw)
      .toLowerCase()
      .replace(/<[^>]+>/g, '')
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    headings.push({ level, text: text.replace(/<[^>]+>/g, ''), slug });

    return `<h${String(level)} id="${slug}"><a href="#${slug}" class="anchor">#</a> ${text}</h${String(level)}>\n`;
  };

  marked.setOptions({ renderer });
  const html = marked(processedMarkdown) as string;

  return { html, headings };
}

/**
 * Generate table of contents HTML
 */
export function generateTOC(headings: Heading[]): string {
  if (headings.length === 0) return '';

  let tocHtml = '<nav class="toc"><div class="toc-title">Contents</div><ul>';
  for (const h of headings) {
    const indent = (h.level - 1) * 0.8;
    tocHtml += `<li style="margin-left:${String(indent)}em"><a href="#${h.slug}">${h.text}</a></li>`;
  }
  tocHtml += '</ul></nav>';

  return tocHtml;
}
