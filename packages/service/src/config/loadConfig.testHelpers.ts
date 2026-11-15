/**
 * Shared fixtures for the `loadConfig` test split: a minimal valid config
 * object and a helper to write it (or a variant) to disk as the server's
 * JSON config file.
 *
 * @packageDocumentation
 */

import fs from 'node:fs';
import path from 'node:path';

export const VALID_CONFIG = {
  port: 9999,
  chromePath: '/usr/bin/chromium',
  auth: { modes: ['keys'] },
  keys: {
    primary: 'a'.repeat(64),
    _internal: 'b'.repeat(64),
  },
  events: {},
};

/** Write `config` as the server's JSON config file under `dir`. */
export function writeConfig(dir: string, config: unknown): string {
  const filePath = path.join(dir, 'jeeves-server.config.json');
  fs.writeFileSync(filePath, JSON.stringify(config));
  return filePath;
}
