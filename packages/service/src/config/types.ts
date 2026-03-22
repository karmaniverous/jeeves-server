/**
 * Runtime and internal types for Jeeves Server.
 * Config types are derived from Zod schema in schema.ts.
 */

import type { AuthMode, JeevesConfig } from './schema.js';

// Re-export config types from schema
export type { AuthMode, JeevesConfig };

/**
 * Normalized scopes — always resolved to \{ allow, deny \} form.
 * null = unrestricted access.
 *
 * Explicit overrides take precedence over named scope patterns:
 * 1. If explicitDeny matches → DENIED (overrides named allow)
 * 2. If explicitAllow matches → ALLOWED (overrides named deny)
 * 3. Otherwise: normal allow AND NOT deny evaluation
 */
export interface NormalizedScopes {
  allow: string[];
  deny: string[];
  /** Explicit allow patterns from the insider/key entry — override named scope denies. */
  explicitAllow: string[];
  /** Explicit deny patterns from the insider/key entry — override named scope allows. */
  explicitDeny: string[];
}

/**
 * Resolved key seed with normalized scopes
 */
export interface ResolvedKey {
  name: string;
  seed: string;
  scopes: NormalizedScopes | null;
}

/**
 * Resolved insider with normalized scopes
 */
export interface ResolvedInsider {
  email: string;
  seed: string;
  scopes: NormalizedScopes | null;
  keyCreatedAt: string | null;
}

/**
 * Combined runtime configuration (post-resolution)
 */
export interface RuntimeConfig {
  port: number;
  host: string;
  eventTimeoutMs: number;
  eventLogPurgeMs: number;
  maxZipSizeMb: number;
  chromePath: string;
  roots?: Record<string, string>;
  mermaidCliPath?: string;
  plantuml: {
    jarPath?: string;
    javaPath?: string;
    servers: string[];
  };
  diagramCachePath?: string;
  runnerUrl?: string;
  watcherUrl?: string;
  metaUrl?: string;
  outsiderPolicy: NormalizedScopes | null;
  events: JeevesConfig['events'];
  authModes: AuthMode[];
  resolvedKeys: ResolvedKey[];
  resolvedInsiders: ResolvedInsider[];
  googleAuth: { clientId: string; clientSecret: string } | null;
  sessionSecret: string | null;
  internalInsiderKey: string | null;
  configPath: string;
  eventsLog: string;
  stateFile: string;
  eventQueuePath: string;
  eventQueueCursorPath: string;
  eventLogPath: string;
}

/**
 * Insider key state (auto-generated, persisted in state.json)
 */
export interface InsiderKeyState {
  seed: string;
  createdAt: string;
}

/**
 * State file structure (mutable runtime state, separate from config)
 */
export interface ServerState {
  keyRotatedAt?: string;
  /** Auto-generated insider keys, keyed by email */
  insiderKeys?: Record<string, InsiderKeyState>;
}

/**
 * Access mode for authenticated requests
 */
export type AccessMode = 'insider' | 'outsider';

/**
 * Key verification result
 */
export interface KeyVerificationResult {
  valid: boolean;
  mode: AccessMode | null;
  keyName: string | null;
  seed: string | null;
  /** For directory outsider links, the ancestor path the key matched against */
  matchedPath: string | null;
}

/**
 * Queue entry for event processing
 */
export interface QueueEntry {
  ts: string;
  event: string;
  cmd: string;
  body: Record<string, unknown>;
  timeoutMs: number;
}

/**
 * Event log entry
 */
export interface EventLogEntry {
  ts: string;
  event: string | null;
  matched: boolean;
  exitCode?: number;
  durationMs?: number;
  bodyPreview?: string;
}
