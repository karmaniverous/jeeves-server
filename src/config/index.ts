import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';
import { z } from 'zod';

import type { ServerState } from './types.js';

import { computeInsiderKey } from '../util/crypto.js';
import { jeevesConfigSchema, insiderEntrySchema, keyEntrySchema } from './schema.js';
import type { JeevesConfig, NormalizedScopes, ResolvedInsider, ResolvedKey, RuntimeConfig } from './types.js';

type InsiderEntry = z.infer<typeof insiderEntrySchema>;
type KeyEntry = z.infer<typeof keyEntrySchema>;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');

const CONFIG_FILENAME = 'jeeves.config';

/**
 * Normalize any scopes format to { allow, deny }.
 * - undefined/null → null (unrestricted)
 * - string → { allow: [string], deny: [] }
 * - string[] → { allow: string[], deny: [] }
 * - { allow?, deny? } → { allow: allow ?? ['/*'], deny: deny ?? [] }
 */
function normalizeScopes(raw: unknown): NormalizedScopes | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw === 'string') return { allow: [raw], deny: [] };
  if (Array.isArray(raw)) return { allow: raw as string[], deny: [] };
  if (typeof raw === 'object') {
    const obj = raw as { allow?: string[]; deny?: string[] };
    return {
      allow: obj.allow ?? ['/*'],
      deny: obj.deny ?? [],
    };
  }
  return null;
}

export function loadConfig(): RuntimeConfig {
  // Use jiti to load TypeScript config at runtime
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

  // Validate with Zod
  const parseResult = jeevesConfigSchema.safeParse(rawConfig);
  if (!parseResult.success) {
    const issues = parseResult.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid configuration in ${CONFIG_FILENAME}.ts:\n${issues}`);
  }

  const config = parseResult.data;

  // Resolve keys
  const resolvedKeys: ResolvedKey[] = Object.entries(
    config.keys as Record<string, KeyEntry>,
  ).map((
    [name, entry]: [string, KeyEntry],
  ) => {
      if (typeof entry === 'string') {
        return { name, seed: entry, scopes: null };
      }
      const scopes = normalizeScopes(entry.scopes);
      return { name, seed: entry.key, scopes };
    },
  );

  // Load state for insider key merging (read file directly to avoid circular dep)
  const stateFile = path.join(rootDir, 'state.json');
  let serverState: ServerState = {};
  try {
    if (fs.existsSync(stateFile)) {
      serverState = JSON.parse(fs.readFileSync(stateFile, 'utf8')) as ServerState;
    }
  } catch {
    // Ignore — empty state
  }

  // Resolve insiders (config defines identity + scopes, state provides keys)
  const resolvedInsiders: ResolvedInsider[] = Object.entries(
    config.insiders as Record<string, InsiderEntry>,
  ).map((
    [email, entry]: [string, InsiderEntry],
  ) => {
      const scopes = normalizeScopes(entry.scopes);
      const stateKey = serverState.insiderKeys?.[email.toLowerCase()];
      return {
        email,
        seed: stateKey?.seed ?? '',
        scopes,
        keyCreatedAt: stateKey?.createdAt ?? null,
      };
    },
  );

  // Derive internal insider key
  const internalKey = resolvedKeys.find((k) => k.name === '_internal');

  return {
    port: config.port,
    eventTimeoutMs: config.eventTimeoutMs,
    eventLogPurgeMs: config.eventLogPurgeMs,
    maxZipSizeMb: config.maxZipSizeMb,
    chromePath: config.chromePath,
    roots: config.roots,
    mermaidCliPath: config.mermaidCliPath,
    outsiderPolicy: normalizeScopes(config.outsiderPolicy) ?? null,
    events: config.events,
    authModes: config.auth.modes,
    resolvedKeys,
    resolvedInsiders,
    googleAuth: config.auth.google ?? null,
    sessionSecret: config.auth.sessionSecret ?? null,
    internalInsiderKey: internalKey ? computeInsiderKey(internalKey.seed) : null,
    configPath: path.join(rootDir, `${CONFIG_FILENAME}.ts`),
    eventsLog: path.join(rootDir, 'logs', 'webhook-events.jsonl'),
    stateFile: path.join(rootDir, 'state.json'),
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
