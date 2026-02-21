/**
 * Content-addressed diagram render cache.
 *
 * Cache key = sha256(type + '\0' + source). Cached artifacts are SVG strings
 * stored as files in a single directory. No timestamp comparison needed:
 * if the source changes, the hash changes → automatic cache miss.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

let cacheDir: string | null = null;

/**
 * Initialize the cache directory. Call once at startup.
 * Defaults to `.diagram-cache` in the current working directory.
 */
export function initDiagramCache(dir?: string): void {
  cacheDir = dir ?? path.resolve('.diagram-cache');
  fs.mkdirSync(cacheDir, { recursive: true });
}

/**
 * Get the cache directory path (for diagnostics / health endpoint).
 */
export function getDiagramCacheDir(): string | null {
  return cacheDir;
}

/**
 * Compute the cache key for a diagram.
 */
function cacheKey(type: string, source: string): string {
  return crypto.createHash('sha256').update(`${type}\0${source}`).digest('hex');
}

/**
 * Look up a cached diagram. Returns the content as a string or null on miss.
 * @param format Output format extension (e.g. 'svg', 'png', 'pdf'). Defaults to 'svg'.
 */
export function getCachedDiagram(
  type: string,
  source: string,
  format: string = 'svg',
): string | null {
  if (!cacheDir) return null;
  const file = path.join(cacheDir, `${cacheKey(type, source)}.${format}`);
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

/**
 * Look up a cached diagram as a Buffer (for binary formats like PNG/PDF).
 * @param format Output format extension (e.g. 'png', 'pdf').
 */
export function getCachedDiagramBuffer(
  type: string,
  source: string,
  format: string,
): Buffer | null {
  if (!cacheDir) return null;
  const file = path.join(cacheDir, `${cacheKey(type, source)}.${format}`);
  try {
    return fs.readFileSync(file);
  } catch {
    return null;
  }
}

/**
 * Store a rendered diagram in the cache (string content).
 * @param format Output format extension. Defaults to 'svg'.
 */
export function cacheDiagram(
  type: string,
  source: string,
  content: string,
  format: string = 'svg',
): void {
  if (!cacheDir) return;
  const file = path.join(cacheDir, `${cacheKey(type, source)}.${format}`);
  try {
    fs.writeFileSync(file, content, 'utf8');
  } catch (err) {
    console.error('[diagramCache] write failed:', (err as Error).message);
  }
}

/**
 * Store a rendered diagram in the cache (binary content).
 * @param format Output format extension (e.g. 'png', 'pdf').
 */
export function cacheDiagramBuffer(
  type: string,
  source: string,
  buffer: Buffer,
  format: string,
): void {
  if (!cacheDir) return;
  const file = path.join(cacheDir, `${cacheKey(type, source)}.${format}`);
  try {
    fs.writeFileSync(file, buffer);
  } catch (err) {
    console.error('[diagramCache] write failed:', (err as Error).message);
  }
}

/**
 * Get a cached diagram or render it and cache the result.
 * Eliminates the repeated getCachedDiagram → render → cacheDiagram pattern.
 */
export async function getOrRenderDiagram(
  type: string,
  source: string,
  renderFn: () => string | null | Promise<string | null>,
  format: string = 'svg',
): Promise<string | null> {
  const cached = getCachedDiagram(type, source, format);
  if (cached) return cached;

  const result = await renderFn();
  if (result) cacheDiagram(type, source, result, format);
  return result;
}
