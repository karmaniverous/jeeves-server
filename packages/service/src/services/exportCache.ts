/**
 * Export cache for PDF/DOCX renders (#288).
 *
 * Entries are addressed by the export cache key (see exportCacheKey.ts): a
 * changed document, print style, server version or referenced image is a
 * different key, so a lookup is a plain hit or miss. A per-file index maps
 * each source path to its keys, so "Clear Cache" removes every entry of a
 * file, or of every file under a directory. A second index maps files to
 * their embedded-diagram cache hashes.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { addToPathIndex, takeFromPathIndex } from './pathIndex.js';

let cacheDir: string | null = null;

/** Formats the export cache holds. */
const EXPORT_FORMATS = ['pdf', 'docx'];

/** Diagram type for a given file extension. */
const DIAGRAM_EXT_MAP: Record<string, string> = {
  '.mmd': 'mermaid',
  '.puml': 'plantuml',
  '.plantuml': 'plantuml',
  '.pu': 'plantuml',
};

/**
 * Initialize the export cache directory. Call once at startup.
 *
 * @param dir - Cache directory (`exportCachePath`); `.export-cache` under
 *   the working directory by default.
 */
export function initExportCache(dir?: string): void {
  cacheDir = path.resolve(dir ?? '.export-cache');
  fs.mkdirSync(cacheDir, { recursive: true });
}

const exportIndexFile = (dir: string): string =>
  path.join(dir, '_export-index.json');

/** A cached export. */
export interface CachedExport {
  /** The rendered bytes. */
  buffer: Buffer;
  /** PDF: the print style it was rendered with. */
  printStyle?: string;
}

/** Metadata stored beside a cached PDF. */
interface ExportMeta {
  printStyle: string;
}

/**
 * Get a cached export.
 *
 * @param key - Export cache key.
 * @param format - Export format.
 * @returns The entry, or `null` on a miss.
 */
export function getCachedExport(
  key: string,
  format: string,
): CachedExport | null {
  if (!cacheDir) return null;
  let buffer: Buffer;
  try {
    buffer = fs.readFileSync(path.join(cacheDir, `${key}.${format}`));
  } catch {
    return null;
  }
  if (format !== 'pdf') return { buffer };
  try {
    const meta = JSON.parse(
      fs.readFileSync(path.join(cacheDir, `${key}.json`), 'utf8'),
    ) as ExportMeta;
    return { buffer, printStyle: meta.printStyle };
  } catch {
    return { buffer };
  }
}

/** What {@link cacheExport} stores. */
export interface ExportEntry {
  /** Source path (indexed for clearing). */
  fsPath: string;
  /** Export cache key. */
  key: string;
  /** Export format. */
  format: string;
  /** The rendered bytes. */
  buffer: Buffer;
  /** The print style it was rendered with (stored beside a PDF). */
  printStyle: string;
}

/**
 * Store an export, its PDF metadata and its index entry.
 *
 * @param entry - See {@link ExportEntry}.
 */
export function cacheExport(entry: ExportEntry): void {
  if (!cacheDir) return;
  const { fsPath, key, format, buffer, printStyle } = entry;
  try {
    fs.writeFileSync(path.join(cacheDir, `${key}.${format}`), buffer);
    if (format === 'pdf') {
      const meta: ExportMeta = { printStyle };
      fs.writeFileSync(
        path.join(cacheDir, `${key}.json`),
        JSON.stringify(meta),
      );
    }
    addToPathIndex(exportIndexFile(cacheDir), fsPath, [key]);
  } catch (err) {
    console.error('[exportCache] write failed:', (err as Error).message);
  }
}

/**
 * Clear every cached export of a file, or of every file under a directory.
 *
 * @param fsPath - File or directory path.
 * @returns The number of cached exports deleted.
 */
export function clearExportCache(fsPath: string): number {
  if (!cacheDir) return 0;
  const dir = cacheDir;
  let count = 0;
  for (const key of takeFromPathIndex(exportIndexFile(dir), fsPath, true)) {
    for (const format of EXPORT_FORMATS) {
      try {
        fs.unlinkSync(path.join(dir, `${key}.${format}`));
        count++;
      } catch {
        // Not cached in this format
      }
    }
    fs.rmSync(path.join(dir, `${key}.json`), { force: true });
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

// --- Reverse index: fsPath to diagram cache hashes ---

const diagramIndexFile = (dir: string): string =>
  path.join(dir, '_diagram-index.json');

/**
 * Register diagram cache hashes associated with a file.
 * Called during diagram rendering to build the reverse index.
 */
export function registerDiagramHashes(fsPath: string, hashes: string[]): void {
  if (!cacheDir || hashes.length === 0) return;
  addToPathIndex(diagramIndexFile(cacheDir), fsPath, hashes);
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

  let count = 0;
  const hashes = takeFromPathIndex(diagramIndexFile(cacheDir), fsPath, false);
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
  return count;
}
