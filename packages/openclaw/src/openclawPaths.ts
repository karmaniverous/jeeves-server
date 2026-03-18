/**
 * OpenClaw home and config path resolution.
 *
 * @remarks
 * Shared by the CLI installer and the in-process plugin commands.
 */

import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

/**
 * Resolve the OpenClaw home directory from environment or default.
 */
export function resolveOpenClawHome(): string {
  if (process.env.OPENCLAW_CONFIG)
    return dirname(resolve(process.env.OPENCLAW_CONFIG));
  if (process.env.OPENCLAW_HOME) return resolve(process.env.OPENCLAW_HOME);
  return join(homedir(), '.openclaw');
}

/**
 * Resolve the OpenClaw config file path from environment or default.
 */
export function resolveConfigPath(home: string): string {
  if (process.env.OPENCLAW_CONFIG) return resolve(process.env.OPENCLAW_CONFIG);
  return join(home, 'openclaw.json');
}
