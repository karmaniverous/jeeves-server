/**
 * Seeds the wire app's caches and credential store so success replies need no Chrome or network: a cached PDF and DOCX of `doc.md`, a cached SVG of `flow.mmd` and of the diagram embedded in `embedded.md`, and two stored OAuth credentials (current and expired). Writes files.
 *
 * @packageDocumentation
 */

import fs from 'node:fs';
import path from 'node:path';

import {
  cacheDiagramBuffer,
  getDiagramCacheDir,
} from '../../services/diagramCache.js';
import { cacheExport } from '../../services/exportCache.js';
import {
  CACHED_EXPORT,
  CACHED_SVG,
  EMBEDDED_MERMAID,
  WIRE_CORPUS,
  WIRE_CREDENTIAL,
  WIRE_EXPIRED_CREDENTIAL,
} from './wireFixture.js';

/** Where the seeds go. */
export interface SeedDirs {
  /** Content root (the export cache is keyed by file path). */
  contentDir: string;
  /** Export cache directory (emptied first). */
  exportCacheDir: string;
  /** OAuth credential directory (already empty). */
  oauthDir: string;
}

/**
 * Empty a directory, keeping it.
 *
 * @param dir - Directory.
 */
function empty(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
  fs.mkdirSync(dir, { recursive: true });
}

/**
 * Seed the caches and the credential store. The diagram and export caches
 * must already be initialised.
 *
 * @param dirs - Seed locations.
 */
export function seedCaches(dirs: SeedDirs): void {
  const diagramDir = getDiagramCacheDir();
  if (diagramDir) empty(diagramDir);
  empty(dirs.exportCacheDir);

  const doc = path.join(dirs.contentDir, 'doc.md');
  cacheExport(doc, 'pdf', CACHED_EXPORT);
  cacheExport(doc, 'docx', CACHED_EXPORT);

  const svg = Buffer.from(CACHED_SVG);
  cacheDiagramBuffer('mermaid', String(WIRE_CORPUS['flow.mmd']), svg, 'svg');
  cacheDiagramBuffer('mermaid', EMBEDDED_MERMAID, svg, 'svg');

  for (const cred of [WIRE_CREDENTIAL, WIRE_EXPIRED_CREDENTIAL]) {
    fs.writeFileSync(
      path.join(dirs.oauthDir, `${cred.provider}-${cred.account}-oauth2.json`),
      JSON.stringify(cred, null, 2),
    );
  }
}
