/**
 * Config resolution — transforms raw validated config into runtime types.
 *
 * Handles: key resolution, insider merging with state, PlantUML server defaults,
 * scope normalization, internal key derivation.
 */

import fs from 'node:fs';
import path from 'node:path';

import { computeInsiderKey } from '../util/crypto.js';
import type { JeevesConfig } from './schema.js';
import type {
  NormalizedScopes,
  ResolvedInsider,
  ResolvedKey,
  RuntimeConfig,
  ServerState,
} from './types.js';

/**
 * Normalize any scopes format to \{ allow, deny \}.
 * - undefined/null → null (unrestricted)
 * - string → \{ allow: [string], deny: [] \}
 * - string[] → \{ allow: string[], deny: [] \}
 * - \{ allow?, deny? \} → \{ allow: allow ?? ['/**'], deny: deny ?? [] \}
 */
export function normalizeScopes(raw: unknown): NormalizedScopes | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw === 'string') return { allow: [raw], deny: [] };
  if (Array.isArray(raw)) return { allow: raw as string[], deny: [] };
  if (typeof raw === 'object') {
    const obj = raw as { allow?: string[]; deny?: string[] };
    return {
      allow: obj.allow ?? ['/**'],
      deny: obj.deny ?? [],
    };
  }
  return null;
}

/**
 * Resolve raw key entries to ResolvedKey[].
 */
export function resolveKeys(
  keys: Record<string, string | { key: string; scopes?: unknown }>,
): ResolvedKey[] {
  return Object.entries(keys).map(([name, entry]) => {
    if (typeof entry === 'string') {
      return { name, seed: entry, scopes: null };
    }
    return { name, seed: entry.key, scopes: normalizeScopes(entry.scopes) };
  });
}

/**
 * Resolve insider entries by merging config (identity + scopes) with state (keys).
 */
export function resolveInsiders(
  insiders: Record<string, { scopes?: unknown }>,
  stateFile: string,
): ResolvedInsider[] {
  let serverState: ServerState = {};
  try {
    if (fs.existsSync(stateFile)) {
      serverState = JSON.parse(
        fs.readFileSync(stateFile, 'utf8'),
      ) as ServerState;
    }
  } catch {
    /* empty state */
  }

  return Object.entries(insiders).map(([rawEmail, entry]) => {
    const email = rawEmail.toLowerCase();
    const scopes = normalizeScopes(entry.scopes);
    const stateKey = serverState.insiderKeys?.[email];
    return {
      email,
      seed: stateKey?.seed ?? '',
      scopes,
      keyCreatedAt: stateKey?.createdAt ?? null,
    };
  });
}

/**
 * Resolve PlantUML config with community server fallback.
 */
export function resolvePlantuml(config?: {
  jarPath?: string;
  javaPath?: string;
  servers?: string[];
}): { jarPath?: string; javaPath?: string; servers: string[] } {
  const COMMUNITY = 'https://www.plantuml.com/plantuml';
  const servers = config?.servers ? [...config.servers] : [];
  if (!servers.includes(COMMUNITY)) servers.push(COMMUNITY);
  return { jarPath: config?.jarPath, javaPath: config?.javaPath, servers };
}

/**
 * Derive the internal insider key from resolved keys.
 */
export function deriveInternalKey(resolvedKeys: ResolvedKey[]): string | null {
  const internalKey = resolvedKeys.find((k) => k.name === '_internal');
  return internalKey ? computeInsiderKey(internalKey.seed) : null;
}

/**
 * Build the full RuntimeConfig from validated config, resolved runtime values, and paths.
 *
 * Centralizes the mapping from parsed config + resolved values → RuntimeConfig,
 * keeping loadConfig focused on loading/validation and this module focused on resolution.
 */
export function buildRuntimeConfig(
  config: JeevesConfig,
  rootDir: string,
  configPath: string,
): RuntimeConfig {
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
    configPath,
    eventsLog: path.join(rootDir, 'logs', 'webhook-events.jsonl'),
    stateFile,
    eventQueuePath: path.join(rootDir, 'logs', 'event-queue.jsonl'),
    eventQueueCursorPath: path.join(rootDir, 'logs', 'event-queue.cursor'),
    eventLogPath: path.join(rootDir, 'logs', 'event-log.jsonl'),
  };
}
