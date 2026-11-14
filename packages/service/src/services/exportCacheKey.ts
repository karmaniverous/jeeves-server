/**
 * The export cache key (#288): SHA-256 of the source path, format,
 * contentHash, print-style fingerprint, server version and image
 * fingerprint. Anything that changes what an export would contain changes
 * the key, so there is no mtime comparison and old entries are simply
 * never hit again. The source path is part of it because the file name is
 * (DOCX title, and the page title of a document without a front-matter
 * `title`).
 *
 * @packageDocumentation
 */

import { createHash } from 'node:crypto';

import { packageVersion } from '../util/packageVersion.js';
import type { RootEntry } from '../util/platform.js';
import { imageFingerprint } from './imageFingerprint.js';
import { indexKey } from './pathIndex.js';

/** The print style an export renders with, as the cache key sees it. */
export interface PrintStyleKey {
  /** Style name, stored beside a cached PDF (`X-Print-Style` on a hit). */
  name: string;
  /** Hash of the style's loaded CSS, templates, page options and assets. */
  fingerprint: string;
}

/** The built-in print style (until print styles are configurable). */
export const DEFAULT_PRINT_STYLE: PrintStyleKey = {
  name: 'default',
  fingerprint: 'builtin',
};

/** Everything an export cache key is made of. */
export interface ExportKeyParts {
  /** Source path, normalised (see `indexKey`). */
  path: string;
  /** Export format (`pdf`, `docx`). */
  format: string;
  /** SHA-256 of the loaded Markdown source. */
  contentHash: string;
  /** Print style fingerprint. */
  styleFingerprint: string;
  /** Server package version. */
  version: string;
  /** Fingerprint of the local images the document references. */
  images: string;
}

/**
 * Hash the key parts.
 *
 * @param parts - Key parts.
 * @returns The hex cache key.
 */
export function exportCacheKey(parts: ExportKeyParts): string {
  return createHash('sha256')
    .update(
      [
        parts.path,
        parts.format,
        parts.contentHash,
        parts.styleFingerprint,
        parts.version,
        parts.images,
      ].join('\0'),
    )
    .digest('hex');
}

/** Options for {@link documentExportKey}. */
export interface DocumentExportKeyOptions {
  /** Configured roots (to resolve `/path/…` image sources). */
  roots: RootEntry[];
  /** Print style; the built-in one by default. */
  style?: PrintStyleKey;
  /** Server version; this package's by default. */
  version?: string;
}

/**
 * The cache key of a loaded document's export.
 *
 * @param fsPath - The document's path.
 * @param doc - The loaded document's source and content hash.
 * @param format - Export format.
 * @param options - See {@link DocumentExportKeyOptions}.
 * @returns The hex cache key.
 */
export function documentExportKey(
  fsPath: string,
  doc: { source: string; contentHash: string },
  format: string,
  options: DocumentExportKeyOptions,
): string {
  return exportCacheKey({
    path: indexKey(fsPath),
    format,
    contentHash: doc.contentHash,
    styleFingerprint: (options.style ?? DEFAULT_PRINT_STYLE).fingerprint,
    version: options.version ?? packageVersion,
    images: imageFingerprint(doc.source, fsPath, options.roots),
  });
}
