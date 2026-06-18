);
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
