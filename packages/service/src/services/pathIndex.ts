/**
 * A JSON file mapping source paths to cache entry ids, so a cache can be
 * cleared for one file or everything under a directory.
 *
 * @packageDocumentation
 */

import fs from 'node:fs';

/** Source path (normalised) to entry ids. */
type PathIndex = Record<string, string[]>;

/**
 * Normalise a path for an index: forward slashes, and lower case on
 * Windows only (its file system ignores case; others don't, so `A.md` and
 * `a.md` are different files there).
 *
 * @param fsPath - File system path.
 * @param platform - The platform (default: this process's).
 * @returns The index key.
 */
export function indexKey(
  fsPath: string,
  platform: NodeJS.Platform = process.platform,
): string {
  const key = fsPath.replace(/\\/g, '/');
  return platform === 'win32' ? key.toLowerCase() : key;
}

/**
 * Whether an index key is a path itself or lies under it.
 *
 * @param key - Index key.
 * @param prefix - Normalised file or directory path.
 * @returns `true` when `key` is `prefix` or below it.
 */
function isUnder(key: string, prefix: string): boolean {
  if (key === prefix) return true;
  return key.startsWith(prefix.endsWith('/') ? prefix : `${prefix}/`);
}

/**
 * Read an index; a missing or unreadable file is empty.
 *
 * @param file - Index file.
 * @returns The index.
 */
function loadPathIndex(file: string): PathIndex {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as PathIndex;
  } catch {
    return {};
  }
}

/**
 * Write an index, logging (not throwing) a failure.
 *
 * @param file - Index file.
 * @param index - The index.
 */
function savePathIndex(file: string, index: PathIndex): void {
  try {
    fs.writeFileSync(file, JSON.stringify(index, null, 2), 'utf8');
  } catch (err) {
    console.error('[exportCache] index write failed:', (err as Error).message);
  }
}

/**
 * Add entry ids to a path's index entry.
 *
 * @param file - Index file.
 * @param fsPath - Source path.
 * @param ids - Entry ids.
 */
export function addToPathIndex(
  file: string,
  fsPath: string,
  ids: string[],
): void {
  const key = indexKey(fsPath);
  const index = loadPathIndex(file);
  index[key] = [...new Set([...(index[key] ?? []), ...ids])];
  savePathIndex(file, index);
}

/**
 * Remove a path's index entries: the path itself, or with `recursive` also
 * every path below it.
 *
 * @param file - Index file.
 * @param fsPath - File or directory path.
 * @param recursive - Also remove paths below `fsPath`.
 * @returns The removed entries' ids.
 */
export function takeFromPathIndex(
  file: string,
  fsPath: string,
  recursive: boolean,
): string[] {
  const prefix = indexKey(fsPath);
  const index = loadPathIndex(file);
  const ids: string[] = [];
  const remaining: PathIndex = {};
  for (const [key, entries] of Object.entries(index)) {
    const matches = recursive ? isUnder(key, prefix) : key === prefix;
    if (matches) ids.push(...entries);
    else remaining[key] = entries;
  }
  if (ids.length > 0) savePathIndex(file, remaining);
  return ids;
}
