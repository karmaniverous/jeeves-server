/**
 * Markdown rendering with TOC generation, Windows path linking, and syntax highlighting
 */

import fs from 'node:fs';

import * as cheerio from 'cheerio';
import MarkdownIt from 'markdown-it';
import anchor from 'markdown-it-anchor';
import taskLists from 'markdown-it-task-lists';

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
 * Custom slugify matching the current algorithm:
 * lowercase → strip HTML tags → remove non-word/non-space/non-dash → whitespace to dash → collapse dashes → trim dashes
 */
function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
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

  // Compute frontmatter line count for source mapping offset
  const frontmatterMatch = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  const frontmatterLineCount = frontmatterMatch
    ? frontmatterMatch[0].split('\n').length - 1
    : 0;

  // Optionally linkify Windows paths
  if (options.linkWindowsPaths) {
    processedMarkdown = linkifyFilesystemPaths(processedMarkdown);
  }

  const md = new MarkdownIt({ html: true });

  // Plugin: markdown-it-anchor for heading slugs and permalink anchors
  md.use(anchor, {
    slugify,
    permalink: anchor.permalink.linkInsideHeader({
      symbol: '#',
      class: 'anchor',
      placement: 'after',
      space: true,
    }),
  });

  // Plugin: GFM task-list checkboxes
  md.use(taskLists as (md: MarkdownIt) => void);

  // Core rule: add source mapping attributes to all block tokens
  md.core.ruler.push('source_map', (state) => {
    for (const token of state.tokens) {
      if (token.map && token.nesting >= 0 && token.type !== 'inline') {
        const start = token.map[0] + 1 + frontmatterLineCount;
        const end = token.map[1] + frontmatterLineCount;
        token.attrSet('data-source-start', String(start));
        token.attrSet('data-source-end', String(end));
      }
    }
  });

  // Custom fence renderer for diagrams and code blocks
  md.renderer.rules.fence = (tokens, idx) => {
    const token = tokens[idx];
    const lang = token.info.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
    const content = token.content;

    // Source mapping attributes (set by core rule)
    const sourceStart = token.attrGet('data-source-start');
    const sourceEnd = token.attrGet('data-source-end');
    const sourceAttrs = sourceStart
      ? ` data-source-start="${sourceStart}" data-source-end="${sourceEnd ?? ''}"`
      : '';

    // Diagram code blocks → register for async rendering
    if (lang === 'mermaid') {
      const placeholder = registerDiagram('mermaid', content);
      return placeholder.replace('<div ', `<div${sourceAttrs} `);
    }
    if (lang === 'plantuml' || lang === 'puml') {
      const placeholder = registerDiagram('plantuml', content);
      return placeholder.replace('<div ', `<div${sourceAttrs} `);
    }

    // Regular code blocks
    const escaped = content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const langClass = lang ? ` class="language-${lang}"` : '';
    return `<pre${sourceAttrs}><code${langClass}>${escaped}</code></pre>\n`;
  };

  // Custom html_block renderer to preserve source mapping.
  // markdown-it's default html_block renderer emits token.content verbatim,
  // ignoring attrs set by the source_map core rule. Inject attributes into the
  // first HTML tag to avoid an extra wrapper <div> that could break CSS selectors.
  md.renderer.rules.html_block = (tokens, idx) => {
    const token = tokens[idx];
    const sourceStart = token.attrGet('data-source-start');
    const sourceEnd = token.attrGet('data-source-end') || sourceStart;
    if (!sourceStart) return token.content;

    const attrs = ` data-source-start="${sourceStart}" data-source-end="${sourceEnd}"`;
    // Inject into the first opening HTML tag (allow leading whitespace)
    const injected = token.content.replace(
      /^(\s*<[a-zA-Z][^\s/>]*)/,
      `$1${attrs}`,
    );
    // If injection succeeded (content changed), use it; otherwise wrap as fallback
    if (injected !== token.content) return injected;
    return `<div${attrs}>${token.content}</div>\n`;
  };

  // Custom image renderer for src rewriting
  if (options.basePath) {
    const base = options.basePath;
    md.renderer.rules.image = (tokens, idx) => {
      const token = tokens[idx];
      let src = token.attrGet('src') ?? '';
      const title = token.attrGet('title') ?? '';
      const alt = token.children
        ? token.children
            .filter((t) => t.type === 'text' || t.type === 'code_inline')
            .map((t) => t.content)
            .join('')
        : '';

      if (src && !src.startsWith('http') && !src.startsWith('data:')) {
        if (!src.startsWith('/')) {
          src = `/api/raw/${base}/${src}`;
        } else if (src.startsWith('/path/')) {
          src = src.replace('/path/', '/api/raw/');
        }
      }
      const titleAttr = title ? ` title="${title}"` : '';
      return `<img src="${src}" alt="${alt}"${titleAttr} />`;
    };
  }

  // Parse tokens
  const env = {};
  const tokens = md.parse(processedMarkdown, env);

  // Extract headings from token stream
  const headings: Heading[] = [];
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].type === 'heading_open') {
      const level = parseInt(tokens[i].tag.slice(1), 10);
      const slug = tokens[i].attrGet('id') ?? '';

      // Next token is inline with heading content
      const inlineToken = tokens[i + 1];
      let text = '';
      if (inlineToken.type === 'inline') {
        // Render inline to get HTML, then strip the permalink anchor and extract plain text
        const rendered = md.renderer.renderInline(
          inlineToken.children ?? [],
          md.options,
          env,
        );
        const $h = cheerio.load(rendered);
        $h('a.anchor').remove();
        text = $h.text().trim();
      }

      headings.push({ level, text, slug });
    }
  }

  // Render HTML from tokens
  let html = md.renderer.render(tokens, md.options, env);

  // Assign sequential data-checkbox-index to GFM task-list checkboxes
  {
    const $ = cheerio.load(html);
    let checkboxIndex = 0;
    $('li input[type="checkbox"]').each(function () {
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
