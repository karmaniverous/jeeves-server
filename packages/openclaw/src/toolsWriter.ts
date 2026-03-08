/**
 * Writes the Server menu section directly to TOOLS.md on disk.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { getApiUrl, getPluginKey, type PluginApi } from './helpers.js';
import { generateServerMenu } from './promptInjection.js';

const REFRESH_INTERVAL_MS = 60_000;

let intervalHandle: ReturnType<typeof setInterval> | null = null;
let lastWrittenMenu = '';

/**
 * Resolve the workspace TOOLS.md path.
 */
function resolveToolsPath(api: PluginApi): string {
  if (api.resolvePath) {
    return api.resolvePath('TOOLS.md');
  }
  return resolve(process.cwd(), 'TOOLS.md');
}

/**
 * Upsert the server section in TOOLS.md content.
 */
function upsertServerContent(existing: string, serverMenu: string): string {
  const section = '## Server\n\n' + serverMenu;

  // Replace existing server section
  const re = /^## Server\n[\s\S]*?(?=\n## |\n# |$(?![\s\S]))/m;
  if (re.test(existing)) {
    return existing.replace(re, section);
  }

  // No existing section — insert under platform tools H1
  const platformH1 = '# Jeeves Platform Tools';

  if (existing.includes(platformH1)) {
    // Find end of H1 line, insert after any existing ## sections
    // Place after ## Watcher if it exists, otherwise after H1
    const watcherEnd = existing.match(
      /^## Watcher\n[\s\S]*?(?=\n## |\n# |$(?![\s\S]))/m,
    );
    if (watcherEnd) {
      const idx = existing.indexOf(watcherEnd[0]) + watcherEnd[0].length;
      return existing.slice(0, idx) + '\n\n' + section + existing.slice(idx);
    }
    const idx = existing.indexOf(platformH1) + platformH1.length;
    return existing.slice(0, idx) + '\n\n' + section + existing.slice(idx);
  }

  // No platform header — prepend
  const trimmed = existing.trim();
  if (trimmed.length === 0) {
    return platformH1 + '\n\n' + section + '\n';
  }
  return platformH1 + '\n\n' + section + '\n\n' + trimmed + '\n';
}

/**
 * Fetch the current server menu and write it to TOOLS.md if changed.
 */
async function refreshToolsMd(api: PluginApi): Promise<boolean> {
  const apiUrl = getApiUrl(api);
  const keySeed = getPluginKey(api);
  const menu = await generateServerMenu(apiUrl, keySeed);

  if (menu === lastWrittenMenu) return false;

  const toolsPath = resolveToolsPath(api);

  let current = '';
  try {
    current = await readFile(toolsPath, 'utf8');
  } catch {
    // File doesn't exist yet
  }

  const updated = upsertServerContent(current, menu);

  if (updated !== current) {
    await writeFile(toolsPath, updated, 'utf8');
    lastWrittenMenu = menu;
    return true;
  }

  lastWrittenMenu = menu;
  return false;
}

/**
 * Start the periodic TOOLS.md writer.
 */
export function startToolsWriter(api: PluginApi): void {
  // Defer first write to allow OpenClaw to fully populate api.config
  // (plugin config may not be available at register() time).
  setTimeout(() => {
    refreshToolsMd(api).catch((err: unknown) => {
      console.error('[jeeves-server] Failed initial TOOLS.md write:', err);
    });
  }, 5000);

  if (intervalHandle) clearInterval(intervalHandle);

  intervalHandle = setInterval(() => {
    refreshToolsMd(api).catch((err: unknown) => {
      console.error('[jeeves-server] Failed to refresh TOOLS.md:', err);
    });
  }, REFRESH_INTERVAL_MS);

  if (typeof intervalHandle === 'object' && 'unref' in intervalHandle) {
    intervalHandle.unref();
  }
}
