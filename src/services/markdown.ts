/**
 * Markdown rendering with TOC generation, Windows path linking, and syntax highlighting
 */

import fs from 'node:fs';

import { marked } from 'marked';

import { registerDiagram } from './embeddedDiagrams.js';

export interface Heading {
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
 * Parse markdown to HTML with heading extraction
 */
export function parseMarkdown(
  markdown: string,
  options: { linkWindowsPaths?: boolean; basePath?: string } = {},
): { html: string; headings: Heading[] } {
  let processedMarkdown = markdown;

  // Optionally linkify Windows paths
  if (options.linkWindowsPaths) {
    processedMarkdown = linkifyFilesystemPaths(processedMarkdown);
  }

  const headings: Heading[] = [];

  // Custom renderer to extract headings and add anchors
  const renderer = new marked.Renderer();

  renderer.heading = function (
    args: string | { text: string; raw?: string; depth: number },
  ) {
    const text = typeof args === 'object' ? args.text : args;
    const raw = typeof args === 'object' && args.raw ? args.raw : text;
    const level = typeof args === 'object' ? args.depth : 1;

    const slug = raw
      .toLowerCase()
      .replace(/<[^>]+>/g, '')
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    headings.push({ level, text: text.replace(/<[^>]+>/g, ''), slug });

    return `<h${String(level)} id="${slug}">${text} <a href="#${slug}" class="anchor">#</a></h${String(level)}>\n`;
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
