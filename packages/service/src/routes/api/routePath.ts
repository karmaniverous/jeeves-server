/**
 * The file system path a content route addresses, from its `*` parameter, with the route errors every content route shares: `SERVER_INVALID_PATH` for an empty path and `SERVER_NOT_FOUND` for a path under no configured root.
 *
 * @packageDocumentation
 */

import path from 'node:path';

import { InvalidPath, NotFound } from '../../api/errors.js';
import { type RootEntry, urlPathToFs } from '../../util/platform.js';

/** Message of `SERVER_NOT_FOUND` for a path with nothing there. */
export const NOT_FOUND_MESSAGE = 'Not found';

/**
 * Require a non-empty route path.
 *
 * @param reqPath - The route's `*` parameter.
 * @returns It.
 * @throws `SERVER_INVALID_PATH` (400) when it is empty.
 */
export function requirePath(reqPath: string | undefined): string {
  if (!reqPath) throw new InvalidPath('Path required');
  return reqPath;
}

/**
 * The absolute file system path of a route path.
 *
 * @param reqPath - The route path (URL form, no leading slash needed).
 * @param roots - The configured roots.
 * @returns The resolved file system path (it may not exist).
 * @throws `SERVER_NOT_FOUND` (404) when the path is under no root.
 */
export function fsPathOf(reqPath: string, roots: RootEntry[]): string {
  const fsPath = urlPathToFs(reqPath, roots);
  if (!fsPath) throw new NotFound(NOT_FOUND_MESSAGE);
  return path.resolve(fsPath);
}
