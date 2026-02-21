/**
 * Config loading and singleton management.
 *
 * Loads jeeves.config.ts via jiti, validates with Zod, resolves runtime types
 * via resolve.ts, and exposes getConfig()/resetConfig().
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createJiti } from 'jiti';

import { jeevesConfigSchema } from './schema.js';
import { resolveKeys, resolveInsiders, resolvePlantuml, deriveInternalKey, normalizeScopes } from './resolve.js';
import type { RuntimeConfig } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');
const CONFIG_FILENAME = 'jeeves.config';

export function loadConfig(): RuntimeConfig {
  const jiti = createJiti(import.meta.url);
  const configPath = path.join(rootDir, CONFIG_FILENAME);
  
  let rawConfig: unknown;
  try {
    const mod = jiti(configPath) as { default?: unknown };
    rawConfig = mod.default ?? mod;
  } catch (err) {
    throw new Error(
      `Failed to load ${CONFIG_FILENAME}.ts. Copy ${CONFIG_FILENAME}.template.ts and configure.\n${String(err)}`
    );
  }

  const parseResult = jeevesConfigSchema.safeParse(rawConfig);
  if (!parseResult.success) {
    const issues = parseResult.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid configuration in ${CONFIG_FILENAME}.ts:\n${issues}`);
  }

  const config = parseResult.data;
  const stateFile = path.join(rootDir, 'state.json');

  const resolvedKeys = resolveKeys(config.keys as Record<string, string | { key: string; scopes?: unknown }>);
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
    diagramCachePath: config.diagramCachePath,
    configPath: path.join(rootDir, `${CONFIG_FILENAME}.ts`),
    eventsLog: path.join(rootDir, 'logs', 'webhook-events.jsonl'),
    stateFile,
    eventQueuePath: path.join(rootDir, 'logs', 'event-queue.jsonl'),
    eventQueueCursorPath: path.join(rootDir, 'logs', 'event-queue.cursor'),
    eventLogPath: path.join(rootDir, 'logs', 'event-log.jsonl'),
  };
}

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
