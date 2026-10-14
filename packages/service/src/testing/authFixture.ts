/**
 * Test fixture: a minimal runtime config with real key seeds, plus helpers
 * that compute genuine HMAC keys, so auth tests exercise real verification.
 * Test-only; imported by `*.test.ts` files and never by the server.
 *
 * @packageDocumentation
 */

import type {
  NormalizedScopes,
  ResolvedInsider,
  ResolvedKey,
  RuntimeConfig,
} from '../config/types.js';

/** Unscoped machine key seed (`resolvedKeys`). */
export const MACHINE_SEED = 'machine-seed-0123456789';

/** Insider seed (`resolvedInsiders`) for `alice@example.com`. */
export const INSIDER_SEED = 'insider-seed-0123456789';

/** Email of the fixture insider. */
export const INSIDER_EMAIL = 'alice@example.com';

/** Build normalized scopes from allow/deny lists. */
export function scopes(allow: string[], deny: string[] = []): NormalizedScopes {
  return { allow, deny, explicitAllow: [], explicitDeny: [] };
}

/** Options for {@link makeRuntimeConfig}. */
export interface FixtureOptions {
  machineScopes?: NormalizedScopes | null;
  insiderScopes?: NormalizedScopes | null;
  extraKeys?: ResolvedKey[];
  extraInsiders?: ResolvedInsider[];
  overrides?: Partial<RuntimeConfig>;
}

/** Build a runtime config with one machine key and one insider. */
export function makeRuntimeConfig(options: FixtureOptions = {}): RuntimeConfig {
  return {
    port: 1934,
    eventTimeoutMs: 30_000,
    eventLogPurgeMs: 2_592_000_000,
    maxZipSizeMb: 100,
    chromePath: 'chrome',
    plantuml: { servers: [] },
    outsiderPolicy: null,
    events: {},
    authModes: ['keys'],
    resolvedKeys: [
      {
        name: 'machine',
        seed: MACHINE_SEED,
        scopes: options.machineScopes ?? null,
      },
      ...(options.extraKeys ?? []),
    ],
    resolvedInsiders: [
      {
        email: INSIDER_EMAIL,
        seed: INSIDER_SEED,
        scopes: options.insiderScopes ?? null,
        keyCreatedAt: null,
      },
      ...(options.extraInsiders ?? []),
    ],
    googleAuth: null,
    sessionSecret: null,
    internalInsiderKey: null,
    oauth: null,
    go: {},
    configPath: 'config.json',
    eventsLog: 'events.log',
    eventQueuePath: 'queue.jsonl',
    eventQueueCursorPath: 'queue.jsonl.cursor',
    eventLogPath: 'event-log.jsonl',
    eventQueueConcurrency: 1,
    ...options.overrides,
  };
}
