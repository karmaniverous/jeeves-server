/**
 * Markdown rendering with TOC generation, Windows path linking, and syntax highlighting
 */

import fs from 'node:fs';

import hljs from 'highlight.js';
import { marked } from 'marked';

export interface Heading {
  level: number;
  text: string;
  slug: string;
}

/**
 * Resolve Windows path for linking (skip non-existent and templated paths)
 */
function resolvePathForLink(winPath: string): string | null {
  // Skip templated paths
  if (winPath.includes('{') || winPath.includes('}')) return null;

  if (!fs.existsSync(winPath)) return null;

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

    const urlPath = `/${resolved.replace(/\\/g, '/').replace(/^([A-Z]):/, (_m: string, d: string) => d.toLowerCase())}`;
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
  options: { linkWindowsPaths?: boolean; basePath?: string } = {},
): { html: string; headings: Heading[] } {
  let processedMarkdown = markdown;

  // Optionally linkify Windows paths
  if (options.linkWindowsPaths) {
    processedMarkdown = linkifyWindowsPaths(processedMarkdown);
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
        // Rewrite relative paths to absolute
        if (!src.startsWith('/')) {
          src = `/path/${base}/${src}`;
        }
        // Ensure raw=1 for /path/ URLs so they serve the actual file
        if (src.startsWith('/path/')) {
          src += (src.includes('?') ? '&' : '?') + 'raw=1';
        }
      }
      const titleAttr = title ? ` title="${title}"` : '';
      return `<img src="${src}" alt="${text}"${titleAttr} />`;
    };
  }

  // Syntax-highlight fenced code blocks
  renderer.code = function (
    args: string | { text: string; lang?: string; escaped?: boolean },
  ) {
    const text = typeof args === 'object' ? args.text : args;
    const lang = typeof args === 'object' ? args.lang : undefined;
    let highlighted: string;
    if (lang && hljs.getLanguage(lang)) {
      highlighted = hljs.highlight(text, { language: lang }).value;
    } else {
      const auto = hljs.highlightAuto(text);
      highlighted = auto.relevance > 5 ? auto.value : text;
    }
    const langClass = lang ? ` class="language-${lang}"` : '';
    return `<pre class="hljs"><code${langClass}>${highlighted}</code></pre>\n`;
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
