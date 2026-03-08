/**
 * Export cache for PDF/DOCX renders.
 *
 * Cache key = sha256(normalizedFsPath + NUL + format).
 * Invalidation: source file mtime greater than cache file mtime = miss.
 * Also maintains a reverse index (fsPath to diagram cache hashes) so
 * "Clear Cache" can purge both export and diagram caches for a file.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

let cacheDir: string | null = null;

/** Diagram type for a given file extension. */
const DIAGRAM_EXT_MAP: Record<string, string> = {
  '.mmd': 'mermaid',
  '.puml': 'plantuml',
  '.plantuml': 'plantuml',
  '.pu': 'plantuml',
};

/** Initialize the export cache directory. Call once at startup. */
export function initExportCache(dir?: string): void {
  cacheDir = dir ?? path.resolve('.export-cache');
  fs.mkdirSync(cacheDir, { recursive: true });
}

function cacheKey(fsPath: string, format: string): string {
  const normalized = fsPath.replace(/\\/g, '/').toLowerCase();
  return crypto
    .createHash('sha256')
    .update(`${normalized}\0${format}`)
    .digest('hex');
}

function cacheFilePath(fsPath: string, format: string): string | null {
  if (!cacheDir) return null;
  return path.join(cacheDir, `${cacheKey(fsPath, format)}.${format}`);
}

/**
 * Get a cached export buffer if it exists and is fresh.
 * Returns null on miss or stale cache.
 */
export function getCachedExport(fsPath: string, format: string): Buffer | null {
  const file = cacheFilePath(fsPath, format);
  if (!file) return null;

  try {
    const sourceStat = fs.statSync(fsPath);
    const cacheStat = fs.statSync(file);
    if (cacheStat.mtimeMs >= sourceStat.mtimeMs) {
      return fs.readFileSync(file);
    }
    // Stale
    return null;
  } catch {
    return null;
  }
}

/** Store an export buffer in the cache. */
export function cacheExport(
  fsPath: string,
  format: string,
  buffer: Buffer,
): void {
  const file = cacheFilePath(fsPath, format);
  if (!file) return;

  try {
    fs.writeFileSync(file, buffer);
  } catch (err) {
    console.error('[exportCache] write failed:', (err as Error).message);
  }
}

/**
 * Clear all cached exports for a given file path.
 * Returns the number of files deleted.
 */
export function clearExportCache(fsPath: string): number {
  if (!cacheDir) return 0;

  let count = 0;
  for (const format of ['pdf', 'docx']) {
    const file = cacheFilePath(fsPath, format);
    if (file) {
      try {
        fs.unlinkSync(file);
        count++;
      } catch {
        // Not cached, that's fine
      }
    }
  }
  return count;
}

/**
 * Clear standalone diagram cache entries for a diagram source file.
 * Reads the file, computes the content-addressed hash, and removes
 * all format variants (svg, png, pdf, eps) from the diagram cache.
 */
export function clearStandaloneDiagramCache(
  fsPath: string,
  diagramCacheDir: string | null,
): number {
  if (!diagramCacheDir) return 0;

  const ext = path.extname(fsPath).toLowerCase();
  const diagramType = DIAGRAM_EXT_MAP[ext];
  if (!diagramType) return 0;

  let source: string;
  try {
    source = fs.readFileSync(fsPath, 'utf8');
  } catch {
    return 0;
  }

  const hash = crypto
    .createHash('sha256')
    .update(`${diagramType}\0${source}`)
    .digest('hex');

  let count = 0;
  for (const fmt of ['svg', 'png', 'pdf', 'eps']) {
    try {
      fs.unlinkSync(path.join(diagramCacheDir, `${hash}.${fmt}`));
      count++;
    } catch {
      // Not present
    }
  }
  return count;
}

// --- Reverse index: fsPath → diagram cache hashes ---

const reverseIndexFile = (): string | null =>
  cacheDir ? path.join(cacheDir, '_diagram-index.json') : null;

type DiagramIndex = Record<string, string[]>;

function loadDiagramIndex(): DiagramIndex {
  const file = reverseIndexFile();
  if (!file) return {};
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as DiagramIndex;
  } catch {
    return {};
  }
}

function saveDiagramIndex(index: DiagramIndex): void {
  const file = reverseIndexFile();
  if (!file) return;
  try {
    fs.writeFileSync(file, JSON.stringify(index, null, 2), 'utf8');
  } catch (err) {
    console.error('[exportCache] index write failed:', (err as Error).message);
  }
}

/**
 * Register diagram cache hashes associated with a file.
 * Called during diagram rendering to build the reverse index.
 */
export function registerDiagramHashes(fsPath: string, hashes: string[]): void {
  if (!cacheDir || hashes.length === 0) return;
  const key = fsPath.replace(/\\/g, '/').toLowerCase();
  const index = loadDiagramIndex();
  const existing = new Set(index[key] ?? []);
  for (const h of hashes) existing.add(h);
  index[key] = [...existing];
  saveDiagramIndex(index);
}

/**
 * Clear diagram cache entries associated with a file.
 * Returns the number of diagram cache files deleted.
 */
export function clearDiagramCacheForFile(
  fsPath: string,
  diagramCacheDir: string | null,
): number {
  if (!cacheDir || !diagramCacheDir) return 0;

  const key = fsPath.replace(/\\/g, '/').toLowerCase();
  const index = loadDiagramIndex();
  const hashes = index[key] as string[] | undefined;
  if (!hashes || hashes.length === 0) return 0;

  let count = 0;
  for (const hash of hashes) {
    // Diagram cache files can be .svg, .png, or .pdf
    for (const ext of ['svg', 'png', 'pdf']) {
      try {
        fs.unlinkSync(path.join(diagramCacheDir, `${hash}.${ext}`));
        count++;
      } catch {
        // Not present
      }
    }
  }

  // Remove from index
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { [key]: _removed, ...rest } = index;
  saveDiagramIndex(rest);

  return count;
}
