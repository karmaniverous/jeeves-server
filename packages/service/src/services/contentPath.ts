/**
 * Filesystem facts about content URL paths under the configured roots.
 *
 * @packageDocumentation
 */

import fs from 'node:fs';

import { getConfig } from '../config/index.js';
import { getRoots, urlPathToFs } from '../util/platform.js';

/** Whether a content URL path names an existing directory (by stat). */
export function isDirectoryUrlPath(urlPath: string): boolean {
  const fsPath = urlPathToFs(
    urlPath.replace(/^\/+/u, ''),
    getRoots(getConfig().roots),
  );
  if (!fsPath) return false;
  try {
    return fs.statSync(fsPath).isDirectory();
  } catch {
    return false;
  }
}
