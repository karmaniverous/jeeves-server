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
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { getConfig } from '../config/index.js';
import { getCachedDiagram, cacheDiagram } from './diagramCache.js';
import { renderPlantUmlSvg } from './plantuml.js';

/** Placeholder format used by the markdown renderer */
const PLACEHOLDER_RE =
  /<!--DIAGRAM:(mermaid|plantuml):([a-f0-9]{64})-->/g;

/**
 * In-flight diagram sources, keyed by content hash.
 * Entries are cleaned up after a TTL to prevent unbounded growth.
 */
const diagramSources = new Map<string, { source: string; contextDir?: string; createdAt: number }>();

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
  if (cleanupInterval.unref) cleanupInterval.unref();
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
  diagramSources.set(hash, { source, contextDir: currentContextDir, createdAt: Date.now() });
  startCleanup();

  // Emit a client-side placeholder that the LazyDiagram component will hydrate
  return `<div class="embedded-diagram-lazy" data-diagram-type="${type}" data-diagram-hash="${hash}"><!--DIAGRAM:${type}:${hash}--></div>\n`;
}

/**
 * Look up a registered diagram source by hash.
 * Used by the /api/diagram endpoint for on-demand rendering.
 */
export function getDiagramSource(hash: string): { type: string; source: string; contextDir?: string } | null {
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
  contextDir?: string,
): Promise<string | null> {
  // Check cache first
  const cached = getCachedDiagram(type, source);
  if (cached) return cached;

  let svg: string | null = null;
  try {
    if (type === 'mermaid') {
      svg = renderMermaidSync(source);
    } else if (type === 'plantuml') {
      svg = await renderPlantUmlFromSource(source, contextDir);
    }
    if (svg) cacheDiagram(type, source, svg);
  } catch (err) {
    console.error(`[embeddedDiagrams] ${type} render failed:`, (err as Error).message);
  }
  return svg;
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
    const source = entry?.source;
    if (!source) continue;

    const svg = await renderDiagramToSvg(type!, source, contextDir ?? entry?.contextDir);

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

/**
 * Render Mermaid source to SVG synchronously via CLI.
 */
function renderMermaidSync(source: string): string | null {
  const config = getConfig();
  const cliPath = config.mermaidCliPath;
  if (!cliPath) return null;

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mmd-'));
  const inFile = path.join(tmpDir, 'diagram.mmd');
  const outFile = path.join(tmpDir, 'diagram.svg');

  try {
    fs.writeFileSync(inFile, source, 'utf8');

    const puppeteerConfig = path.resolve('puppeteer.json');
    const puppeteerArg = fs.existsSync(puppeteerConfig)
      ? ` -p "${puppeteerConfig}"`
      : '';

    const mmcdCmd = `npx --prefix "${cliPath}" mmdc`;
    execSync(
      `${mmcdCmd} -i "${inFile}" -o "${outFile}" -w 1600 -s 2 -b white${puppeteerArg}`,
      { timeout: 30_000, stdio: 'pipe' },
    );

    if (!fs.existsSync(outFile)) return null;
    return fs.readFileSync(outFile, 'utf8');
  } catch (err) {
    console.error('[embeddedDiagrams] Mermaid CLI error:', (err as Error).message);
    return null;
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

/**
 * Render PlantUML source string to SVG.
 */
async function renderPlantUmlFromSource(
  source: string,
  contextDir?: string,
): Promise<string | null> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'puml-embed-'));
  const inFile = path.join(tmpDir, 'diagram.puml');

  try {
    fs.writeFileSync(inFile, source, 'utf8');
    const svg = await renderPlantUmlSvg(inFile);
    return svg;
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
