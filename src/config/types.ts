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
 * Main configuration from config.json
 */
export interface Config {
  port: number;
  eventTimeoutMs: number;
  eventLogPurgeMs: number;
  chromePath: string;
  events: Record<string, EventConfig>;
}

/**
 * Local secrets configuration from config.json.local
 */
export interface LocalConfig {
  apiKey: string;
  keys: Record<string, string>;
}

/**
 * Combined runtime configuration
 */
export interface RuntimeConfig extends Config {
  apiKey: string;
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
