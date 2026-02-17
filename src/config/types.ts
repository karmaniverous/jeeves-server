/**
 * Runtime and internal types for Jeeves Server.
 * Config types are derived from Zod schema in schema.ts.
 */

import type {
  JeevesConfig,
  AuthMode,
} from './schema.js';

// Re-export config types from schema
export type {
  JeevesConfig,
  AuthMode,
};

/**
 * Resolved key seed with normalized scopes
 */
export interface ResolvedKey {
  name: string;
  seed: string;
  scopes: string[] | null;
}

/**
 * Resolved insider with normalized scopes
 */
export interface ResolvedInsider {
  email: string;
  seed: string;
  scopes: string[] | null;
  keyCreatedAt: string | null;
}

/**
 * Combined runtime configuration (post-resolution)
 */
export interface RuntimeConfig {
  port: number;
  eventTimeoutMs: number;
  eventLogPurgeMs: number;
  maxZipSizeMb: number;
  chromePath: string;
  roots?: Record<string, string>;
  mermaidCliPath?: string;
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
