/**
 * Configuration loading and management
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Config, LocalConfig, RuntimeConfig } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');

/**
 * Load configuration from config.json and config.json.local
 */
export function loadConfig(): RuntimeConfig {
  // Load main config
  const configPath = path.join(rootDir, 'config.json');
  if (!fs.existsSync(configPath)) {
    throw new Error('config.json not found');
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf8')) as Config;

  // Load local config (secrets)
  const localConfigPath = path.join(rootDir, 'config.json.local');
  if (!fs.existsSync(localConfigPath)) {
    throw new Error(
      'config.json.local not found. Copy config.json.local.template and configure your API key.',
    );
  }

  const localConfig = JSON.parse(
    fs.readFileSync(localConfigPath, 'utf8'),
  ) as LocalConfig;

  if (
    !localConfig.apiKey ||
    localConfig.apiKey === 'your-secret-api-key-here'
  ) {
    throw new Error('API key not configured in config.json.local');
  }

  // Build runtime config
  const runtimeConfig: RuntimeConfig = {
    ...config,
    apiKey: localConfig.apiKey,
    eventsLog: path.join(rootDir, 'logs', 'webhook-events.jsonl'),
    stateFile: path.join(rootDir, 'state.json'),
    eventQueuePath: path.join(rootDir, 'logs', 'event-queue.jsonl'),
    eventQueueCursorPath: path.join(rootDir, 'logs', 'event-queue.cursor'),
    eventLogPath: path.join(rootDir, 'logs', 'event-log.jsonl'),
  };

  return runtimeConfig;
}

// Export singleton instance
let configInstance: RuntimeConfig | null = null;

export function getConfig(): RuntimeConfig {
  if (!configInstance) {
    configInstance = loadConfig();
  }
  return configInstance;
}

export function resetConfig(): void {
  configInstance = null;
}
