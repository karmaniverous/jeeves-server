/**
 * Embedded diagram support for Mermaid and PlantUML code blocks in markdown.
 *
 * Strategy: parseMarkdown() calls registerDiagram() which stores the source
 * and returns a placeholder div. The client lazily fetches rendered SVGs
 * via GET /api/diagram/:type/:hash.svg, which renders on-demand and caches.
 *
 * For PDF/DOCX export (server-side rendering), renderEmbeddedDiagrams()
 * replaces placeholders with inline SVGs synchronously.
 */

import crypto from 'node:crypto';

import { getOrRenderDiagram } from './diagramCache.js';
import { renderMermaidFromSource } from './mermaid.js';
import { renderPlantUmlFromSource } from './plantuml.js';

/** Placeholder format used by the markdown renderer */
const PLACEHOLDER_RE = /<!--DIAGRAM:(mermaid|plantuml):([a-f0-9]{64})-->/g;

/**
 * In-flight diagram sources, keyed by content hash.
 * Entries are cleaned up after a TTL to prevent unbounded growth.
 */
const diagramSources = new Map<
  string,
  { source: string; contextDir?: string; createdAt: number }
>();

/** TTL for source map entries (10 minutes) */
const SOURCE_TTL_MS = 10 * 60 * 1000;

/** Periodic cleanup interval */
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

function startCleanup(): void {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [hash, entry] of diagramSources) {
      if (now - entry.createdAt > SOURCE_TTL_MS) {
        diagramSources.delete(hash);
      }
    }
  }, 60_000);
  // Don't keep process alive just for cleanup
  cleanupInterval.unref();
}

/**
 * Compute content hash matching the cache key format.
 */
export function diagramHash(type: string, source: string): string {
  return crypto.createHash('sha256').update(`${type}\0${source}`).digest('hex');
}

/** Module-level context directory for the current markdown parse. */
let currentContextDir: string | undefined;

/**
 * Set the context directory for diagram registration.
 * Call before parseMarkdown() so registered diagrams know their !include context.
 */
export function setDiagramContext(contextDir?: string): void {
  currentContextDir = contextDir;
}

/**
 * Register a diagram source and return a placeholder HTML div.
 * Called synchronously from the marked renderer.
 */
export function registerDiagram(
  type: 'mermaid' | 'plantuml',
  source: string,
): string {
  const hash = diagramHash(type, source);
  diagramSources.set(hash, {
    source,
    contextDir: currentContextDir,
    createdAt: Date.now(),
  });
  startCleanup();

  // Emit a client-side placeholder that the LazyDiagram component will hydrate
  return `<div class="embedded-diagram-lazy" data-diagram-type="${type}" data-diagram-hash="${hash}"><!--DIAGRAM:${type}:${hash}--></div>\n`;
}

/**
 * Look up a registered diagram source by hash.
 * Used by the /api/diagram endpoint for on-demand rendering.
 */
export function getDiagramSource(
  hash: string,
): { type: string; source: string; contextDir?: string } | null {
  const entry = diagramSources.get(hash);
  if (!entry) return null;
  return { type: '', source: entry.source, contextDir: entry.contextDir };
}

/**
 * Render a diagram to SVG (with cache). Used by the /api/diagram endpoint.
 */
export async function renderDiagramToSvg(
  type: string,
  source: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _contextDir?: string,
): Promise<string | null> {
  try {
    return await getOrRenderDiagram(type, source, () => {
      if (type === 'mermaid') return renderMermaidFromSource(source);
      if (type === 'plantuml') return renderPlantUmlFromSource(source);
      return null;
    });
  } catch (err) {
    console.error(
      `[embeddedDiagrams] ${type} render failed:`,
      (err as Error).message,
    );
    return null;
  }
}

/**
 * Replace all diagram placeholders in rendered HTML with inline SVGs.
 * Used for PDF/DOCX export where client-side lazy loading isn't available.
 */
export async function renderEmbeddedDiagrams(
  html: string,
  contextDir?: string,
): Promise<string> {
  const matches = [...html.matchAll(PLACEHOLDER_RE)];
  if (matches.length === 0) return html;

  let result = html;
  for (const match of matches) {
    const [placeholder, type, hash] = match;
    const entry = diagramSources.get(hash);
    if (!entry) continue;
    const source = entry.source;
    if (!source) continue;

    const svg = await renderDiagramToSvg(
      type,
      source,
      contextDir ?? entry.contextDir,
    );

    if (svg) {
      const wrapped = `<div class="embedded-diagram-rendered" data-type="${type}">${svg}</div>`;
      result = result.replace(placeholder, wrapped);
    } else {
      const escaped = escapeHtml(source);
      const errorBlock = `<div class="embedded-diagram-error" data-type="${type}"><div class="diagram-error-label">${type} render failed</div><pre class="hljs"><code>${escaped}</code></pre></div>`;
      result = result.replace(placeholder, errorBlock);
    }
  }

  return result;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
