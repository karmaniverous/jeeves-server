/**
 * JSONL event queue for webhooks
 */

import fs from 'node:fs';
import path from 'node:path';

import { getConfig } from '../config/index.js';
import { nowIso } from '../util/formatters.js';

/**
 * Ensure directory exists
 */
function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

/**
 * Append a JSON object as a line to the event log
 */
export function appendEvent(event: Record<string, unknown>): void {
  const { eventsLog } = getConfig();
  ensureDir(path.dirname(eventsLog));
  const line = JSON.stringify({ at: nowIso(), ...event }) + '\n';
  fs.appendFileSync(eventsLog, line, 'utf8');
}
