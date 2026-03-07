/**
 * @packageDocumentation
 *
 * Config loading and singleton management.
 * Loads config via cosmiconfig, validates with Zod, applies env var substitution,
 * resolves runtime types via resolve.ts, and exposes getConfig()/resetConfig().
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { cosmiconfig } from 'cosmiconfig';

import {
  deriveInternalKey,
  normalizeScopes,
  resolveInsiders,
  resolveKeys,
  resolvePlantuml,
} from './resolve.js';
import { jeevesConfigSchema } from './schema.js';
import { substituteEnvVars } from './substituteEnvVars.js';
import type { RuntimeConfig } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../../..');

const MODULE_NAME = 'jeeves-server';

/**
 * Load and validate jeeves-server configuration via cosmiconfig.
 *
 * Searches for `jeeves-server.config.{json,yaml,yml,js,ts,cjs,mjs}`
 * or `.jeeves-serverrc` in the package root and parent directories.
 *
 * @param configPath - Optional explicit path to a config file.
 * @returns Resolved runtime configuration.
 */
export async function loadConfig(configPath?: string): Promise<RuntimeConfig> {
  const explorer = cosmiconfig(MODULE_NAME);

  const result = configPath
    ? await explorer.load(configPath)
    : await explorer.search(rootDir);

  if (!result || result.isEmpty) {
    throw new Error(
      `No jeeves-server configuration found. Create a jeeves-server.config.json (or .yaml/.toml) file.\n` +
        `Searched from: ${rootDir}`,
    );
  }

  const substituted = substituteEnvVars(
    result.config as Record<string, unknown>,
  );

  const parseResult = jeevesConfigSchema.safeParse(substituted);
  if (!parseResult.success) {
    const issues = parseResult.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid configuration in ${result.filepath}:\n${issues}`);
  }

  const config = parseResult.data;
  const stateFile = path.join(rootDir, 'state.json');

  const resolvedKeys = resolveKeys(
    config.keys as Record<string, string | { key: string; scopes?: unknown }>,
  );
  const resolvedInsiders = resolveInsiders(
    config.insiders as Record<string, { scopes?: unknown }>,
    stateFile,
  );

  return {
    port: config.port,
    eventTimeoutMs: config.eventTimeoutMs,
    eventLogPurgeMs: config.eventLogPurgeMs,
    maxZipSizeMb: config.maxZipSizeMb,
    chromePath: config.chromePath,
    roots: config.roots,
    mermaidCliPath: config.mermaidCliPath,
    plantuml: resolvePlantuml(config.plantuml),
    outsiderPolicy: normalizeScopes(config.outsiderPolicy) ?? null,
    events: config.events,
    authModes: config.auth.modes,
    resolvedKeys,
    resolvedInsiders,
    googleAuth: config.auth.google ?? null,
    sessionSecret: config.auth.sessionSecret ?? null,
    internalInsiderKey: deriveInternalKey(resolvedKeys),
    runnerUrl: config.runnerUrl,
    watcherUrl: config.watcherUrl,
    diagramCachePath: config.diagramCachePath,
    configPath: result.filepath,
    eventsLog: path.join(rootDir, 'logs', 'webhook-events.jsonl'),
    stateFile,
    eventQueuePath: path.join(rootDir, 'logs', 'event-queue.jsonl'),
    eventQueueCursorPath: path.join(rootDir, 'logs', 'event-queue.cursor'),
    eventLogPath: path.join(rootDir, 'logs', 'event-log.jsonl'),
  };
}

let configInstance: RuntimeConfig | null = null;

/**
 * Get the singleton config instance. Initializes on first call.
 * @throws If config has not been initialized — call initConfig() first.
 */
export function getConfig(): RuntimeConfig {
  if (!configInstance) {
    throw new Error(
      'Config not initialized. Call initConfig() before getConfig().',
    );
  }
  return configInstance;
}

/**
 * Initialize the config singleton. Must be called once at startup.
 * @param configPath - Optional explicit path to a config file.
 */
export async function initConfig(configPath?: string): Promise<RuntimeConfig> {
  configInstance = await loadConfig(configPath);
  return configInstance;
}

/**
 * Reset the config singleton (for testing).
 */
export function resetConfig(): void {
  configInstance = null;
}
