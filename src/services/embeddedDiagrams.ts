/**
 * Render Mermaid and PlantUML code blocks embedded in markdown HTML.
 *
 * Strategy: parseMarkdown() inserts placeholder divs for diagram code blocks.
 * This module async-replaces them with rendered SVGs.
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { getConfig } from '../config/index.js';
import { getCachedDiagram, cacheDiagram } from './diagramCache.js';
import { renderPlantUmlSvg } from './plantuml.js';

/** Placeholder format used by the markdown renderer */
const PLACEHOLDER_RE =
  /<!--DIAGRAM:(mermaid|plantuml):([a-f0-9]+)-->/g;

/** In-flight diagram sources, keyed by hash */
const diagramSources = new Map<string, string>();

/**
 * Register a diagram source and return a placeholder HTML comment.
 * Called synchronously from the marked renderer.
 */
export function registerDiagram(
  type: 'mermaid' | 'plantuml',
  source: string,
): string {
  const hash = simpleHash(source);
  diagramSources.set(hash, source);
  // Wrap in a div so the placeholder survives marked's HTML processing
  return `<div class="embedded-diagram" data-type="${type}"><!--DIAGRAM:${type}:${hash}--></div>\n`;
}

/**
 * Replace all diagram placeholders in rendered HTML with SVGs.
 * Call this after parseMarkdown() returns.
 */
export async function renderEmbeddedDiagrams(
  html: string,
  /** Directory context for PlantUML !include resolution */
  contextDir?: string,
): Promise<string> {
  const matches = [...html.matchAll(PLACEHOLDER_RE)];
  if (matches.length === 0) return html;

  let result = html;
  for (const match of matches) {
    const [placeholder, type, hash] = match;
    const source = diagramSources.get(hash);
    if (!source) continue;

    let svg: string | null = getCachedDiagram(type!, source);
    if (svg) {
      // Cache hit — skip rendering
    } else {
      try {
        if (type === 'mermaid') {
          svg = renderMermaidSync(source);
        } else if (type === 'plantuml') {
          svg = await renderPlantUmlFromSource(source, contextDir);
        }
        if (svg) cacheDiagram(type!, source, svg);
      } catch (err) {
        console.error(`[embeddedDiagrams] ${type} render failed:`, (err as Error).message);
      }
    }

    if (svg) {
      // Wrap SVG in a container for panzoom support in the client
      const wrapped = `<div class="embedded-diagram-rendered" data-type="${type}">${svg}</div>`;
      result = result.replace(placeholder, wrapped);
    } else {
      // Render failure — show source as code block with error note
      const escaped = escapeHtml(source);
      const errorBlock = `<div class="embedded-diagram-error" data-type="${type}"><div class="diagram-error-label">${type} render failed</div><pre class="hljs"><code>${escaped}</code></pre></div>`;
      result = result.replace(placeholder, errorBlock);
    }

    diagramSources.delete(hash);
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

    // Check for puppeteer config — look relative to server root (process.cwd())
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
 * Writes to a temp file so the jar can process it.
 */
async function renderPlantUmlFromSource(
  source: string,
  contextDir?: string,
): Promise<string | null> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'puml-embed-'));
  const inFile = path.join(tmpDir, 'diagram.puml');

  try {
    fs.writeFileSync(inFile, source, 'utf8');
    // If we have a context dir, symlink/copy for includes? For now, just render standalone.
    const svg = await renderPlantUmlSvg(inFile);
    return svg;
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

function simpleHash(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
