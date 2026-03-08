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

import { buildRuntimeConfig } from './resolve.js';
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
  const explorer = cosmiconfig(MODULE_NAME, {
    searchPlaces: [
      'package.json',
      `.${MODULE_NAME}rc`,
      `.${MODULE_NAME}rc.json`,
      `.${MODULE_NAME}rc.yaml`,
      `.${MODULE_NAME}rc.yml`,
      `${MODULE_NAME}.config.json`,
      `${MODULE_NAME}.config.yaml`,
      `${MODULE_NAME}.config.yml`,
      `${MODULE_NAME}.config.js`,
      `${MODULE_NAME}.config.ts`,
      `${MODULE_NAME}.config.mjs`,
      `${MODULE_NAME}.config.cjs`,
    ],
  });

  const result = configPath
    ? await explorer.load(configPath)
    : await explorer.search(rootDir);

  if (!result || result.isEmpty) {
    throw new Error(
      `No jeeves-server configuration found. Create a jeeves-server.config.json (or .yaml) file.\n` +
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

  return buildRuntimeConfig(parseResult.data, rootDir, result.filepath);
}

let configInstance: RuntimeConfig | null = null;
let lastConfigPath: string | undefined;

/**
 * Check if the config singleton has been initialized.
 */
export function isConfigInitialized(): boolean {
  return configInstance !== null;
}

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
  lastConfigPath = configPath;
  configInstance = await loadConfig(configPath);
  return configInstance;
}

/**
 * Reload the config singleton from the last-used config path.
 * Call after mutating state that affects resolved config (e.g., key rotation).
 */
export async function resetConfig(): Promise<void> {
  configInstance = await loadConfig(lastConfigPath);
}

/**
 * Clear the config singleton (for testing only).
 */
export function clearConfig(): void {
  configInstance = null;
}
