/**
 * Shared plugin removal logic for extension directory and config cleanup.
 *
 * @remarks
 * Used by both the CLI `uninstall` command and the in-process
 * `PluginCommands.uninstall()` implementation.
 */

import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { patchConfig } from '@karmaniverous/jeeves';

import { PLUGIN_ID } from './constants.js';

/**
 * Remove the plugin extension directory and patch the OpenClaw config.
 *
 * @param home - OpenClaw home directory path.
 * @param configPath - OpenClaw config file path.
 * @returns Messages describing what was changed.
 */
export function removePlugin(home: string, configPath: string): string[] {
  const messages: string[] = [];
  const extDir = join(home, 'extensions', PLUGIN_ID);

  if (existsSync(extDir)) {
    rmSync(extDir, { recursive: true, force: true });
    messages.push('Removed ' + extDir);
  }

  if (existsSync(configPath)) {
    const raw = readFileSync(configPath, 'utf8');
    const config = JSON.parse(raw) as Record<string, unknown>;
    const patchMessages = patchConfig(config, PLUGIN_ID, 'remove');
    if (patchMessages.length > 0) {
      writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
      messages.push(...patchMessages);
    }
  }

  return messages;
}
