/**
 * Platform abstraction for filesystem operations.
 *
 * Handles the differences between Windows (drive letters, backslashes)
 * and Linux (mount points, forward slashes) for URL path ↔ filesystem path conversion.
 */

import fs from 'node:fs';
import path from 'node:path';

const IS_WINDOWS = process.platform === 'win32';

export interface RootEntry {
  /** URL-safe identifier (drive letter lowercase on Windows, mount name on Linux) */
  id: string;
  /** Display label */
  label: string;
  /** Filesystem path */
  fsPath: string;
}

/**
 * Discover available filesystem roots.
 * Windows: enumerate accessible drive letters.
 * Linux: return configured roots or default to '/'.
 */
export function getRoots(configuredRoots?: Record<string, string>): RootEntry[] {
  if (IS_WINDOWS) {
    const roots: RootEntry[] = [];
    for (let code = 65; code <= 90; code++) {
      const letter = String.fromCharCode(code);
      const drivePath = `${letter}:\\`;
      try {
        fs.accessSync(drivePath, fs.constants.R_OK);
        roots.push({ id: letter.toLowerCase(), label: `${letter}:`, fsPath: drivePath });
      } catch {
        // Drive not accessible
      }
    }
    return roots;
  }

  // Linux: use configured roots or default to filesystem root
  if (configuredRoots && Object.keys(configuredRoots).length > 0) {
    return Object.entries(configuredRoots).map(([id, fsPath]) => ({
      id,
      label: fsPath,
      fsPath: fsPath.endsWith('/') ? fsPath : fsPath + '/',
    }));
  }

  return [{ id: 'root', label: '/', fsPath: '/' }];
}

/**
 * Convert a URL path to a filesystem path.
 *
 * URL paths use forward slashes and start with the root id:
 *   Windows: /e/jeeves-server/README.md → E:\jeeves-server\README.md
 *   Linux:   /home/user/docs/README.md → /home/user/docs/README.md
 *            /root/docs/README.md       → /docs/README.md (if root id is "root" mapping to "/")
 */
export function urlPathToFs(urlPath: string, roots: RootEntry[]): string | null {
  const normalized = urlPath.replace(/^\/+/, '');
  if (!normalized) return null;

  if (IS_WINDOWS) {
    // First segment is the drive letter
    const slashIdx = normalized.indexOf('/');
    const driveLetter = slashIdx >= 0 ? normalized.substring(0, slashIdx) : normalized;
    const rest = slashIdx >= 0 ? normalized.substring(slashIdx + 1) : '';

    if (driveLetter.length !== 1) return null;
    const fsPath = `${driveLetter.toUpperCase()}:\\${rest.replace(/\//g, '\\')}`;
    return fsPath;
  }

  // Linux: match against configured roots
  for (const root of roots) {
    if (normalized.startsWith(root.id + '/') || normalized === root.id) {
      const rest = normalized.substring(root.id.length);
      // rest starts with '/' or is empty
      const fsPath = root.fsPath.replace(/\/+$/, '') + (rest || '/');
      return fsPath;
    }
  }

  return null;
}

/**
 * Convert a filesystem path to a URL path.
 *
 * Windows: E:\jeeves-server\README.md → /e/jeeves-server/README.md
 * Linux:   /home/user/docs/README.md → /home/user/docs/README.md (root="root" → "/")
 */
export function fsPathToUrl(fsPath: string, roots: RootEntry[]): string {
  if (IS_WINDOWS) {
    return '/' + fsPath
      .replace(/\\/g, '/')
      .replace(/^([A-Za-z]):/, (_, d: string) => d.toLowerCase());
  }

  // Linux: find the matching root and prepend the root id
  for (const root of roots) {
    const rootFs = root.fsPath.replace(/\/+$/, '');
    if (fsPath === rootFs || fsPath.startsWith(rootFs + '/')) {
      const rest = fsPath.substring(rootFs.length); // starts with '/' or is empty
      if (root.id === 'root' && root.fsPath === '/') {
        // Default root — URL path is just the fs path
        return rest || '/';
      }
      return '/' + root.id + rest;
    }
  }

  // Fallback: return as-is with forward slashes
  return fsPath.replace(/\\/g, '/');
}

/**
 * Split a filesystem path into breadcrumb parts.
 * Returns [{label, urlPath}] from root to leaf.
 */
export function breadcrumbParts(fsPath: string, roots: RootEntry[]): { label: string; path: string }[] {
  const urlPath = fsPathToUrl(fsPath, roots);
  const parts = urlPath.replace(/^\/+/, '').split('/').filter(p => p);

  return parts.map((_part, i) => {
    const accumulated = parts.slice(0, i + 1).join('/');
    return { label: parts[i], path: accumulated };
  });
}

/**
 * Recursively calculate total size of a directory in bytes.
 */
export function getDirSize(dirPath: string): number {
  let totalSize = 0;
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(dirPath, entry.name);
      try {
        if (entry.isDirectory()) {
          totalSize += getDirSize(entryPath);
        } else {
          const s = fs.statSync(entryPath);
          totalSize += s.size;
        }
      } catch { /* skip inaccessible */ }
    }
  } catch { /* skip inaccessible */ }
  return totalSize;
}

/**
 * Resolve a URL path to a real filesystem path, verifying it exists.
 * Returns null if the path doesn't resolve to an accessible location.
 */
export function resolveUrlPath(urlPath: string, roots: RootEntry[]): string | null {
  const fsPath = urlPathToFs(urlPath, roots);
  if (!fsPath) return null;

  try {
    const resolved = path.resolve(fsPath);
    fs.accessSync(resolved, fs.constants.R_OK);
    return resolved;
  } catch {
    return null;
  }
}
