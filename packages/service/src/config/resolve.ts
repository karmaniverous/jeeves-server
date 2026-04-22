/**
 * Config resolution — transforms raw validated config into runtime types.
 *
 * Handles: key resolution, insider resolution, PlantUML server defaults,
 * scope normalization, internal key derivation.
 */

import fs from 'node:fs';
import path from 'node:path';

import { computeInsiderKey } from '../util/crypto.js';
import type { JeevesConfig } from './schema.js';
import { isScopeName } from './schema.js';
import type {
  NormalizedScopes,
  ResolvedInsider,
  ResolvedKey,
  RuntimeConfig,
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
  if (typeof raw === 'string')
    return { allow: [raw], deny: [], explicitAllow: [], explicitDeny: [] };
  if (Array.isArray(raw))
    return {
      allow: raw as string[],
      deny: [],
      explicitAllow: [],
      explicitDeny: [],
    };
  if (typeof raw === 'object') {
    const obj = raw as { allow?: string[]; deny?: string[] };
    return {
      allow: obj.allow ?? ['/**'],
      deny: obj.deny ?? [],
      explicitAllow: [],
      explicitDeny: [],
    };
  }
  return null;
}

/**
 * Resolve named scope references (string or string[]) against the top-level scopes map,
 * optionally merging explicit allow/deny overrides.
 *
 * Returns null if no scopes are provided.
 * Falls back to normalizeScopes() for legacy inline scope formats.
 */
export function resolveNamedScopes(
  named: Record<string, { allow?: string[]; deny?: string[] } | undefined>,
  rawScopes: unknown,
  overrides?: { allow?: string[]; deny?: string[] },
): NormalizedScopes | null {
  if (rawScopes === undefined || rawScopes === null) {
    if (overrides?.allow?.length || overrides?.deny?.length) {
      return {
        allow: overrides.allow ?? ['/**'],
        deny: overrides.deny ?? [],
        explicitAllow: overrides.allow ?? [],
        explicitDeny: overrides.deny ?? [],
      };
    }
    return null;
  }

  // Determine whether rawScopes is a named reference (identifier(s))
  const refs =
    typeof rawScopes === 'string'
      ? isScopeName(rawScopes)
        ? [rawScopes]
        : null
      : Array.isArray(rawScopes) &&
          rawScopes.every((v) => typeof v === 'string')
        ? rawScopes.filter((v) => isScopeName(v))
        : null;

  if (refs && refs.length > 0) {
    const allow: string[] = [];
    const deny: string[] = [];

    for (const ref of refs) {
      const scope = named[ref];
      if (!scope) continue; // schema should have validated
      if (scope.allow) allow.push(...scope.allow);
      if (scope.deny) deny.push(...scope.deny);
    }

    if (overrides?.allow) allow.push(...overrides.allow);
    if (overrides?.deny) deny.push(...overrides.deny);

    return {
      allow: allow.length > 0 ? allow : ['/**'],
      deny,
      explicitAllow: overrides?.allow ?? [],
      explicitDeny: overrides?.deny ?? [],
    };
  }

  // Legacy inline scopes
  const normalized = normalizeScopes(rawScopes);
  if (!normalized) return null;
  if (overrides?.allow) normalized.allow.push(...overrides.allow);
  if (overrides?.deny) normalized.deny.push(...overrides.deny);
  normalized.explicitAllow = overrides?.allow ?? [];
  normalized.explicitDeny = overrides?.deny ?? [];
  return normalized;
}

/**
 * Resolve raw key entries to ResolvedKey[].
 */
export function resolveKeys(
  keys: Record<
    string,
    | string
    | { key: string; scopes?: unknown; allow?: string[]; deny?: string[] }
  >,
  namedScopes: Record<string, { allow?: string[]; deny?: string[] }>,
): ResolvedKey[] {
  return Object.entries(keys).map(([name, entry]) => {
    if (typeof entry === 'string') {
      return { name, seed: entry, scopes: null };
    }
    return {
      name,
      seed: entry.key,
      scopes: resolveNamedScopes(namedScopes, entry.scopes, {
        allow: entry.allow,
        deny: entry.deny,
      }),
    };
  });
}

/**
 * Resolve insider entries from config seeds.
 */
export function resolveInsiders(
  insiders: Record<
    string,
    {
      scopes?: unknown;
      allow?: string[];
      deny?: string[];
      seed?: string;
      keyCreatedAt?: string;
    }
  >,
  namedScopes: Record<string, { allow?: string[]; deny?: string[] }>,
): ResolvedInsider[] {
  return Object.entries(insiders).map(([rawEmail, entry]) => {
    const email = rawEmail.toLowerCase();
    const scopes = resolveNamedScopes(namedScopes, entry.scopes, {
      allow: entry.allow,
      deny: entry.deny,
    });
    const seed = entry.seed ?? '';
    const keyCreatedAt = entry.keyCreatedAt ?? null;
    return { email, seed, scopes, keyCreatedAt };
  });
}

/**
 * Resolve PlantUML config with auto-discovery and community server fallback.
 *
 * If no jarPath is configured, checks for a bundled jar at vendor/plantuml.jar
 * (downloaded by the postinstall script).
 */
export function resolvePlantuml(
  config?: {
    jarPath?: string;
    javaPath?: string;
    servers?: string[];
  },
  rootDir?: string,
): { jarPath?: string; javaPath?: string; servers: string[] } {
  const COMMUNITY = 'https://www.plantuml.com/plantuml';
  const servers = config?.servers ? [...config.servers] : [];
  if (!servers.includes(COMMUNITY)) servers.push(COMMUNITY);

  let jarPath = config?.jarPath;
  if (!jarPath && rootDir) {
    const vendorJar = path.join(rootDir, 'vendor', 'plantuml.jar');
    if (fs.existsSync(vendorJar)) {
      jarPath = vendorJar;
    }
  }

  return { jarPath, javaPath: config?.javaPath, servers };
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
  const resolvedKeys = resolveKeys(config.keys, config.scopes);
  const resolvedInsiders = resolveInsiders(config.insiders, config.scopes);

  return {
    port: config.port,
    eventTimeoutMs: config.eventTimeoutMs,
    eventLogPurgeMs: config.eventLogPurgeMs,
    maxZipSizeMb: config.maxZipSizeMb,
    chromePath: config.chromePath,
    roots: config.roots,
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    mermaidCliPath: config.mermaidCliPath,
    plantuml: resolvePlantuml(config.plantuml, rootDir),
    outsiderPolicy:
      resolveNamedScopes(
        config.scopes,
        (config.outsiderPolicy as unknown) &&
          typeof config.outsiderPolicy === 'object' &&
          !Array.isArray(config.outsiderPolicy)
          ? ((config.outsiderPolicy as { scopes?: unknown }).scopes ??
              config.outsiderPolicy)
          : config.outsiderPolicy,
        (config.outsiderPolicy as unknown) &&
          typeof config.outsiderPolicy === 'object' &&
          !Array.isArray(config.outsiderPolicy)
          ? {
              allow: (config.outsiderPolicy as { allow?: string[] }).allow,
              deny: (config.outsiderPolicy as { deny?: string[] }).deny,
            }
          : undefined,
      ) ?? null,
    events: config.events,
    authModes: config.auth.modes,
    resolvedKeys,
    resolvedInsiders,
    googleAuth: config.auth.google ?? null,
    sessionSecret: config.auth.sessionSecret ?? null,
    internalInsiderKey: deriveInternalKey(resolvedKeys),
    diagramCachePath: config.diagramCachePath,
    oauth: config.oauth
      ? {
          credentialDir: config.oauth.credentialDir,
          providers: config.oauth.providers,
        }
      : null,
    go: config.go,
    configPath,
    eventsLog: path.join(rootDir, 'logs', 'webhook-events.jsonl'),
    eventQueuePath: path.join(rootDir, 'logs', 'event-queue.jsonl'),
    eventQueueCursorPath: path.join(rootDir, 'logs', 'event-queue.cursor'),
    eventLogPath: path.join(rootDir, 'logs', 'event-log.jsonl'),
  };
}
