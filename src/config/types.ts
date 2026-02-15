/**
 * Configuration types for Jeeves Server
 */

/**
 * Event configuration (for future webhook customization)
 */
export interface EventConfig {
  [key: string]: unknown;
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
