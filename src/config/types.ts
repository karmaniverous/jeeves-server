/**
 * Configuration types for Jeeves Server
 */

/**
 * Event configuration for webhook event processing
 */
export interface EventConfig {
  schema: object; // JSON Schema for ajv validation
  cmd: string; // Command to execute when schema matches
  map?: object; // Optional JsonMap transform
  timeoutMs?: number; // Override default timeout
}

/**
 * A named API key seed entry.
 * Plain string = seed value, no scope restrictions.
 * Object = seed value + optional path scope restrictions.
 */
export type KeyEntry = string | { key: string; scopes?: string | string[] };

/**
 * Google OAuth configuration
 */
export interface GoogleAuthConfig {
  clientId: string;
  clientSecret: string;
}

/**
 * Auth configuration block
 */
export interface AuthConfig {
  google?: GoogleAuthConfig;
  sessionSecret?: string;
}

/**
 * Insider entry: a Google-authenticated human user.
 * `key` is auto-generated on first login and persisted.
 */
export interface InsiderEntry {
  scopes?: string | string[];
  key?: string;
  keyCreatedAt?: string;
}

/**
 * Unified configuration from jeeves.config.json
 */
export interface JeevesConfig {
  port: number;
  eventTimeoutMs: number;
  eventLogPurgeMs: number;
  chromePath: string;
  events: Record<string, EventConfig>;
  auth?: AuthConfig;
  insiders?: Record<string, InsiderEntry>;
  keys: Record<string, KeyEntry>;
}

/**
 * Resolved key seed with normalized scopes
 */
export interface ResolvedKey {
  name: string;
  seed: string;
  scopes: string[] | null; // null = unscoped (all paths)
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
 * Combined runtime configuration
 */
/**
 * Combined runtime configuration
 */
export interface RuntimeConfig {
  port: number;
  eventTimeoutMs: number;
  eventLogPurgeMs: number;
  chromePath: string;
  events: Record<string, EventConfig>;
  resolvedKeys: ResolvedKey[];
  resolvedInsiders: ResolvedInsider[];
  auth: AuthConfig | null;
  configPath: string;
  eventsLog: string;
  stateFile: string;
  eventQueuePath: string;
  eventQueueCursorPath: string;
  eventLogPath: string;
}

/**
 * State file structure
 */
export interface ServerState {
  keyRotatedAt?: string;
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
