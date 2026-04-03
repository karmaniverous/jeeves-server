/**
 * @packageDocumentation
 *
 * Config loading and singleton management.
 * Loads config from a JSON file, validates with Zod, applies env var substitution,
 * resolves runtime types via resolve.ts, and exposes getConfig()/resetConfig().
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { migrateConfigPath } from './migration.js';
import { buildRuntimeConfig } from './resolve.js';
import { DEPRECATED_CONFIG_PROPS, jeevesConfigSchema } from './schema.js';
import { substituteEnvVars } from './substituteEnvVars.js';
import type { RuntimeConfig } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../../..');

/**
 * Load and validate jeeves-server configuration from a JSON file.
 *
 * @param configPath - Optional explicit path to a config file.
 * @returns Resolved runtime configuration.
 */
export function loadConfig(configPath?: string): RuntimeConfig {
  const resolvedPath = configPath
    ? migrateConfigPath(configPath)
    : findDefaultConfig();

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(
      `Configuration file not found: ${resolvedPath}\n` +
        `Create a jeeves-server config.json file or pass --config <path>.`,
    );
  }

  // Reject non-JSON config files
  const ext = path.extname(resolvedPath).toLowerCase();
  if (ext && ext !== '.json') {
    throw new Error(
      `Unsupported config file format: ${ext}\n` +
        `Only JSON configuration files are supported. ` +
        `Please convert your config to JSON format.`,
    );
  }

  const rawContent = fs.readFileSync(resolvedPath, 'utf8');
  let rawConfig: Record<string, unknown>;
  try {
    rawConfig = JSON.parse(rawContent) as Record<string, unknown>;
  } catch (err) {
    throw new Error(
      `Failed to parse config file ${resolvedPath}: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err },
    );
  }

  // Strip deprecated v3.6.0 properties before validation
  const cleanedConfig: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rawConfig)) {
    if (
      DEPRECATED_CONFIG_PROPS.includes(
        key as (typeof DEPRECATED_CONFIG_PROPS)[number],
      )
    ) {
      console.warn(
        `[jeeves-server] Deprecated config property "${key}" ignored. ` +
          `Companion service URLs are now resolved via core config ` +
          `({configRoot}/jeeves-core/config.json services.{name}.url). ` +
          `Bind address is resolved via getBindAddress(). ` +
          `Remove "${key}" from ${resolvedPath} to silence this warning.`,
      );
    } else {
      cleanedConfig[key] = value;
    }
  }

  const substituted = substituteEnvVars(cleanedConfig);

  const parseResult = jeevesConfigSchema.safeParse(substituted);
  if (!parseResult.success) {
    const issues = parseResult.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid configuration in ${resolvedPath}:\n${issues}`);
  }

  return buildRuntimeConfig(parseResult.data, rootDir, resolvedPath);
}

/**
 * Find the default config file in the package root directory.
 */
function findDefaultConfig(): string {
  // Try new convention first
  const newPath = path.join(rootDir, 'jeeves-server', 'config.json');
  if (fs.existsSync(newPath)) return newPath;

  // Fall back to old convention
  const oldPath = path.join(rootDir, 'jeeves-server.config.json');
  if (fs.existsSync(oldPath)) return oldPath;

  // Return new path for error message
  return newPath;
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
export function initConfig(configPath?: string): RuntimeConfig {
  lastConfigPath = configPath;
  configInstance = loadConfig(configPath);
  return configInstance;
}

/**
 * Reload the config singleton from the last-used config path.
 * Call after mutating state that affects resolved config (e.g., key rotation).
 */
export function resetConfig(): void {
  configInstance = loadConfig(lastConfigPath);
}

/**
 * Clear the config singleton (for testing only).
 */
export function clearConfig(): void {
  configInstance = null;
}
