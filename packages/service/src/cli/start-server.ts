#!/usr/bin/env node
/**
 * Minimal server launcher for use by system service managers (NSSM, systemd, launchd).
 *
 * This is the entry point referenced by `descriptor.startCommand`. It initializes
 * config from the `--config` CLI argument and starts the Fastify server directly,
 * without going through the full Commander CLI.
 *
 * The CLI's `start` command uses this same logic in-process.
 */

const major = Number(process.versions.node.split('.')[0]);
if (major < 22) {
  console.error(
    'jeeves-server requires Node.js >= 22. Current: ' + process.version,
  );
  process.exit(1);
}

import { init } from '@karmaniverous/jeeves';

import { initConfig } from '../config/index.js';

function parseArg(name: string): string | undefined {
  const idx = process.argv.indexOf(name);
  return idx !== -1 && process.argv[idx + 1]
    ? process.argv[idx + 1]
    : undefined;
}

const configPath = parseArg('--config');
const workspace =
  parseArg('--workspace') ?? process.env['JEEVES_WORKSPACE'] ?? '.';
const configRoot =
  parseArg('--config-root') ?? process.env['JEEVES_CONFIG_ROOT'] ?? './config';

init({ workspacePath: workspace, configRoot });
initConfig(configPath);

// Dynamic import to ensure config is initialized before server modules load
await import('../server.js');
