/**
 * Markdown rendering with TOC generation, Windows path linking, and syntax highlighting
 */

import fs from 'node:fs';

import * as cheerio from 'cheerio';
import type { Token } from 'marked';
import { marked } from 'marked';

import { registerDiagram } from './embeddedDiagrams.js';

interface Heading {
  level: number;
  text: string;
  slug: string;
}

/**
 * Resolve a filesystem path for linking (skip non-existent and templated paths)
 */
function resolvePathForLink(fsPath: string): string | null {
  // Skip templated paths
  if (fsPath.includes('{') || fsPath.includes('}')) return null;

  if (!fs.existsSync(fsPath)) return null;

  return fsPath;
}

const IS_WINDOWS = process.platform === 'win32';

/**
 * Convert platform-native filesystem paths in markdown text to clickable browse links.
 * Windows: C:\\foo\\bar → [C:\\foo\\bar](/browse/c/foo/bar)
 * Linux: /home/user/docs → [/home/user/docs](/browse/home/user/docs)
 */
function linkifyFilesystemPaths(markdown: string): string {
  // Platform-specific path regex
  const pathRegex = IS_WINDOWS
    ? /([A-Z]):\\(?:[^\s"'`<>\\]+\\)*[^\s"'`<>\\]+/g
    : /(?<=\s|^)(\/(?:home|opt|var|tmp|etc|usr|srv|mnt|media)\/[^\s"'`<>]+)/gm;

  const linkifyPath = (fsPath: string): string => {
    const resolved = resolvePathForLink(fsPath);
    if (!resolved) return fsPath;

    let urlPath: string;
    if (IS_WINDOWS) {
      urlPath =
        '/' +
        resolved
          .replace(/\\/g, '/')
          .replace(/^([A-Z]):/, (_m: string, d: string) => d.toLowerCase());
    } else {
      urlPath = resolved;
    }
    return `[${fsPath}](/browse${urlPath})`;
  };

  // Split by code blocks and inline code
  const codeBlockRegex = /(```[\s\S]*?```|`[^`\n]+`)/g;
  const parts = markdown.split(codeBlockRegex);

  return parts
    .map((part) => {
      if (part.startsWith('```') || part.startsWith('`')) {
        return part; // Don't modify code
      }
      return part.replace(pathRegex, linkifyPath);
    })
    .join('');
}

/**
 * Extract YAML frontmatter from markdown if present.
 * Returns the frontmatter content (without delimiters) and the remaining markdown.
 */
function extractFrontmatter(markdown: string): {
  frontmatter: string | null;
  body: string;
} {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!match) return { frontmatter: null, body: markdown };
  return { frontmatter: match[1], body: markdown.slice(match[0].length) };
}

/**
 * Parse markdown to HTML with heading extraction
 */
export function parseMarkdown(
  markdown: string,
  options: { linkWindowsPaths?: boolean; basePath?: string } = {},
): { html: string; headings: Heading[] } {
  // Extract frontmatter before processing
  const { frontmatter, body } = extractFrontmatter(markdown);
  let processedMarkdown = body;

  // Optionally linkify Windows paths
  if (options.linkWindowsPaths) {
    processedMarkdown = linkifyFilesystemPaths(processedMarkdown);
  }

  const headings: Heading[] = [];

  // Custom renderer to extract headings and add anchors
  const renderer = new marked.Renderer();

  renderer.heading = function (
    args:
      | string
      | {
          text: string;
          raw?: string;
          depth: number;
          tokens?: Token[];
        },
  ) {
    const text = typeof args === 'object' ? args.text : args;
    const raw = typeof args === 'object' && args.raw ? args.raw : text;
    const level = typeof args === 'object' ? args.depth : 1;

    // Parse inline tokens to render code spans, bold, italic, links, etc.
    const renderedText =
      typeof args === 'object' && args.tokens
        ? this.parser.parseInline(args.tokens)
        : text;

    const slug = raw
      .toLowerCase()
      .replace(/<[^>]+>/g, '')
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    headings.push({
      level,
      text: cheerio.load(renderedText).text(),
      slug,
    });

    return `<h${String(level)} id="${slug}">${renderedText} <a href="#${slug}" class="anchor">#</a></h${String(level)}>\n`;
  };

  // Rewrite relative image src to /path/ URLs
  if (options.basePath) {
    const base = options.basePath;
    renderer.image = function (
      args: string | { href: string; title: string | null; text: string },
    ) {
      const href = typeof args === 'object' ? args.href : args;
      const title = typeof args === 'object' ? args.title : '';
      const text = typeof args === 'object' ? args.text : '';
      let src = href;
      if (src && !src.startsWith('http') && !src.startsWith('data:')) {
        // Rewrite relative paths to /api/raw/ for file serving
        if (!src.startsWith('/')) {
          src = `/api/raw/${base}/${src}`;
        } else if (src.startsWith('/path/')) {
          // Legacy /path/ references → /api/raw/
          src = src.replace('/path/', '/api/raw/');
        }
      }
      const titleAttr = title ? ` title="${title}"` : '';
      return `<img src="${src}" alt="${text}"${titleAttr} />`;
    };
  }

  // Syntax-highlight fenced code blocks; render mermaid/plantuml as diagrams
  renderer.code = function (
    args: string | { text: string; lang?: string; escaped?: boolean },
  ) {
    const text = typeof args === 'object' ? args.text : args;
    const lang = (
      typeof args === 'object' ? args.lang : undefined
    )?.toLowerCase();

    // Diagram code blocks → register for async rendering (GitHub convention)
    if (lang === 'mermaid') {
      return registerDiagram('mermaid', text);
    }
    if (lang === 'plantuml' || lang === 'puml') {
      return registerDiagram('plantuml', text);
    }

    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const langClass = lang ? ` class="language-${lang}"` : '';
    return `<pre><code${langClass}>${escaped}</code></pre>\n`;
  };

  marked.setOptions({ renderer });
  let html = marked(processedMarkdown) as string;

  // Assign sequential data-checkbox-index to GFM task-list checkboxes
  {
    const $ = cheerio.load(html);
    let checkboxIndex = 0;
    $('li > input[type="checkbox"]').each(function () {
      $(this).attr('data-checkbox-index', String(checkboxIndex++));
    });
    html = $('body').html() ?? html;
  }

  // Prepend frontmatter as a rendered YAML code block
  if (frontmatter) {
    const FRONTMATTER_COLLAPSE_THRESHOLD = 10;
    const escaped = frontmatter
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const lines = frontmatter.split('\n');

    if (lines.length > FRONTMATTER_COLLAPSE_THRESHOLD) {
      const previewEscaped = lines
        .slice(0, FRONTMATTER_COLLAPSE_THRESHOLD)
        .join('\n')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      html =
        `<div class="frontmatter-block frontmatter-collapsible">` +
        `<div class="frontmatter-preview"><pre><code class="language-yaml">${previewEscaped}</code></pre></div>` +
        `<div class="frontmatter-full"><pre><code class="language-yaml">${escaped}</code></pre></div>` +
        `<button class="frontmatter-toggle" onclick="this.parentElement.classList.toggle('frontmatter-expanded'); ` +
        `this.textContent = this.parentElement.classList.contains('frontmatter-expanded') ` +
        `? 'Show less' : 'Show all (${String(lines.length)} lines)'">Show all (${String(lines.length)} lines)</button>` +
        `</div>\n${html}`;
    } else {
      html = `<div class="frontmatter-block"><pre><code class="language-yaml">${escaped}</code></pre></div>\n${html}`;
    }
  }

  return { html, headings };
}
