/**
 * Configuration loading and management
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type {
  InsiderEntry,
  JeevesConfig,
  KeyEntry,
  ResolvedInsider,
  ResolvedKey,
  RuntimeConfig,
} from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');

const CONFIG_FILENAME = 'jeeves.config.json';

/**
 * Load configuration from jeeves.config.json
 */
export function loadConfig(): RuntimeConfig {
  const configPath = path.join(rootDir, CONFIG_FILENAME);
  if (!fs.existsSync(configPath)) {
    throw new Error(
      `${CONFIG_FILENAME} not found. Copy jeeves.config.template.json and configure.`,
    );
  }

  const config = JSON.parse(
    fs.readFileSync(configPath, 'utf8'),
  ) as JeevesConfig;

  if (Object.keys(config.keys).length === 0) {
    throw new Error(
      `No keys configured in ${CONFIG_FILENAME}. At least one key is required.`,
    );
  }

  // Resolve keys into normalized form
  const resolvedKeys: ResolvedKey[] = Object.entries(config.keys).map(
    ([name, entry]: [string, KeyEntry]) => {
      if (typeof entry === 'string') {
        return { name, seed: entry, scopes: null };
      }
      const scopes = entry.scopes
        ? Array.isArray(entry.scopes)
          ? entry.scopes
          : [entry.scopes]
        : null;
      return { name, seed: entry.key, scopes };
    },
  );

  // Resolve insiders into normalized form
  const resolvedInsiders: ResolvedInsider[] = Object.entries(
    config.insiders ?? {},
  ).map(([email, entry]: [string, InsiderEntry]) => {
    const scopes = entry.scopes
      ? Array.isArray(entry.scopes)
        ? entry.scopes
        : [entry.scopes]
      : null;
    return {
      email,
      seed: entry.key ?? '',
      scopes,
      keyCreatedAt: entry.keyCreatedAt ?? null,
    };
  });

  // Build runtime config
  const runtimeConfig: RuntimeConfig = {
    port: config.port,
    eventTimeoutMs: config.eventTimeoutMs,
    eventLogPurgeMs: config.eventLogPurgeMs,
    chromePath: config.chromePath,
    events: config.events,
    resolvedKeys,
    resolvedInsiders,
    auth: config.auth ?? null,
    configPath,
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
