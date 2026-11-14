/**
 * Config resolution — transforms raw validated config into runtime types.
 *
 * Handles: key resolution, insider resolution, PlantUML server defaults,
 * internal key derivation. Scope resolution is in resolveScopes.ts.
 */

import fs from 'node:fs';
import path from 'node:path';

import { computeInsiderKey } from '../util/crypto.js';
import { resolveNamedScopes } from './resolveScopes.js';
import type { JeevesConfig } from './schema.js';
import { DEFAULT_BRANDING } from './schema.js';
import type { ResolvedInsider, ResolvedKey, RuntimeConfig } from './types.js';

export { normalizeScopes, resolveNamedScopes } from './resolveScopes.js';

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
 * Resolve event queue and log file paths.
 *
 * When `eventQueue` is configured, all event-related files are co-located in
 * the same directory. Otherwise they fall back to `{rootDir}/logs/`.
 */
function resolveEventPaths(
  eventQueue: string | undefined,
  rootDir: string,
): Pick<
  RuntimeConfig,
  'eventsLog' | 'eventQueuePath' | 'eventQueueCursorPath' | 'eventLogPath'
> {
  const logDir = eventQueue
    ? path.dirname(eventQueue)
    : path.join(rootDir, 'logs');

  return {
    eventsLog: path.join(logDir, 'webhook-events.jsonl'),
    eventQueuePath: eventQueue ?? path.join(logDir, 'event-queue.jsonl'),
    eventQueueCursorPath: eventQueue
      ? eventQueue + '.cursor'
      : path.join(logDir, 'event-queue.cursor'),
    eventLogPath: path.join(logDir, 'event-log.jsonl'),
  };
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
    accessContact: config.auth.accessContact,
    sessionSecret: config.auth.sessionSecret ?? null,
    internalInsiderKey: deriveInternalKey(resolvedKeys),
    diagramCachePath: config.diagramCachePath,
    exportCachePath: config.exportCachePath,
    printStyles: config.printStyles,
    oauth: config.oauth
      ? {
          credentialDir: config.oauth.credentialDir,
          providers: config.oauth.providers,
        }
      : null,
    logging: config.logging,
    go: config.go,
    branding: {
      name: config.branding?.name ?? DEFAULT_BRANDING.name,
      emoji: config.branding?.emoji ?? DEFAULT_BRANDING.emoji,
      theme: config.branding?.theme,
      emailTemplate: config.branding?.emailTemplate,
    },
    emailAuth:
      config.auth.modes.includes('email') && config.auth.email
        ? {
            smtpUrl: config.auth.email.smtpUrl,
            fromAddress: config.auth.email.fromAddress,
          }
        : null,
    configPath,
    publicUrl: config.publicUrl,
    trustProxyHeaders: config.trustProxyHeaders,
    eventQueueConcurrency: config.eventQueueConcurrency,
    ...resolveEventPaths(config.eventQueue, rootDir),
  };
}
