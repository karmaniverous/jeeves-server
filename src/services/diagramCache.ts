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
 * Look up a cached SVG. Returns the SVG string or null on miss.
 */
export function getCachedDiagram(type: string, source: string): string | null {
  if (!cacheDir) return null;
  const file = path.join(cacheDir, `${cacheKey(type, source)}.svg`);
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

/**
 * Store a rendered SVG in the cache.
 */
export function cacheDiagram(type: string, source: string, svg: string): void {
  if (!cacheDir) return;
  const file = path.join(cacheDir, `${cacheKey(type, source)}.svg`);
  try {
    fs.writeFileSync(file, svg, 'utf8');
  } catch (err) {
    console.error('[diagramCache] write failed:', (err as Error).message);
  }
}
