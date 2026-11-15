/**
 * Event logging service - logs all events (matched and unmatched)
 */

import fs from 'node:fs';

import { getConfig } from '../config/index.js';
import type { EventLogEntry } from '../config/types.js';
import { writeFileAtomic } from '../util/atomicWrite.js';
import { nowIso } from '../util/formatters.js';
import { parseJsonlObjects } from '../util/jsonl.js';

/**
 * Parse the JSONL file line by line; a malformed line (torn by a full disk
 * or a crash) is skipped, so it can't break a reader or the next write.
 */
function parseJsonl(filePath: string): EventLogEntry[] {
  if (!fs.existsSync(filePath)) return [];

  const content = fs.readFileSync(filePath, 'utf8');
  return parseJsonlObjects(content, filePath).entries.filter(
    (entry): entry is Record<string, unknown> & EventLogEntry =>
      typeof entry.ts === 'string',
  );
}

/**
 * Replace the JSONL file atomically (temp file + rename), so a failed
 * write leaves the previous log intact.
 */
function writeJsonl(filePath: string, entries: EventLogEntry[]): void {
  const content = entries.map((entry) => JSON.stringify(entry)).join('\n');
  writeFileAtomic(filePath, content + '\n');
}

/**
 * Purge entries older than configured retention period
 */
function purgeOldEntries(entries: EventLogEntry[]): EventLogEntry[] {
  const { eventLogPurgeMs } = getConfig();
  const cutoff = new Date(Date.now() - eventLogPurgeMs);

  return entries.filter((entry) => new Date(entry.ts) >= cutoff);
}

/**
 * Append an event to the log and purge old entries
 */
export function logEvent(entry: Omit<EventLogEntry, 'ts'>): void {
  const { eventLogPath } = getConfig();

  // Read existing entries
  const entries = parseJsonl(eventLogPath);

  // Add new entry with timestamp
  entries.push({ ts: nowIso(), ...entry });

  // Purge old entries
  const purgedEntries = purgeOldEntries(entries);

  // Write back
  writeJsonl(eventLogPath, purgedEntries);
}

/**
 * Get the most recent N event log entries (newest first).
 */
export function getRecentEvents(limit: number): EventLogEntry[] {
  const { eventLogPath } = getConfig();
  const entries = parseJsonl(eventLogPath);
  return entries.slice(-limit).reverse();
}
