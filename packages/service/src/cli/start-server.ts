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

import { initConfig } from '../config/index.js';

const configIndex = process.argv.indexOf('--config');
const configPath =
  configIndex !== -1 ? process.argv[configIndex + 1] : undefined;

initConfig(configPath);

// Dynamic import to ensure config is initialized before server modules load
await import('../server.js');
