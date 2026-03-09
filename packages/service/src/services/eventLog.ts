/**
 * Event logging service - logs all events (matched and unmatched)
 */

import fs from 'node:fs';
import path from 'node:path';

import { getConfig } from '../config/index.js';
import type { EventLogEntry } from '../config/types.js';
import { nowIso } from '../util/formatters.js';

/**
 * Ensure directory exists
 */
function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

/**
 * Parse JSONL file into entries
 */
function parseJsonl(filePath: string): EventLogEntry[] {
  if (!fs.existsSync(filePath)) return [];

  const content = fs.readFileSync(filePath, 'utf8');
  return content
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as EventLogEntry);
}

/**
 * Write entries to JSONL file
 */
function writeJsonl(filePath: string, entries: EventLogEntry[]): void {
  const content = entries.map((entry) => JSON.stringify(entry)).join('\n');
  fs.writeFileSync(filePath, content + '\n', 'utf8');
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
  ensureDir(path.dirname(eventLogPath));

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
