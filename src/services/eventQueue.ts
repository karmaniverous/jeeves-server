/**
 * Durable event queue for webhook event processing
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { getConfig } from '../config/index.js';
import type { QueueEntry } from '../config/types.js';
import { nowIso } from '../util/formatters.js';
import { logEvent } from './eventLog.js';

/**
 * Ensure directory exists
 */
function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

/**
 * Append a JSON object as a line to the general event log (backward compatibility)
 * This is separate from the Event Gateway event log
 */
export function appendEvent(event: Record<string, unknown>): void {
  const { eventsLog } = getConfig();
  ensureDir(path.dirname(eventsLog));
  const line = JSON.stringify({ at: nowIso(), ...event }) + '\n';
  fs.appendFileSync(eventsLog, line, 'utf8');
}

/**
 * Append a queue entry to the durable queue
 */
export function enqueue(
  event: string,
  cmd: string,
  body: Record<string, unknown>,
  timeoutMs: number,
): void {
  const { eventQueuePath } = getConfig();
  ensureDir(path.dirname(eventQueuePath));

  const entry: QueueEntry = {
    ts: nowIso(),
    event,
    cmd,
    body,
    timeoutMs,
  };

  const line = JSON.stringify(entry) + '\n';
  fs.appendFileSync(eventQueuePath, line, 'utf8');
}

/**
 * Read cursor position (byte offset of last processed entry)
 */
function readCursor(): number {
  const { eventQueueCursorPath } = getConfig();
  if (!fs.existsSync(eventQueueCursorPath)) return 0;

  const content = fs.readFileSync(eventQueueCursorPath, 'utf8').trim();
  return parseInt(content, 10) || 0;
}

/**
 * Write cursor position
 */
function writeCursor(position: number): void {
  const { eventQueueCursorPath } = getConfig();
  ensureDir(path.dirname(eventQueueCursorPath));
  fs.writeFileSync(eventQueueCursorPath, position.toString(), 'utf8');
}

/**
 * Parse JSONL entries from file starting at cursor position
 */
function readEntriesFromCursor(): {
  entries: QueueEntry[];
  newPosition: number;
} {
  const { eventQueuePath } = getConfig();

  if (!fs.existsSync(eventQueuePath)) {
    return { entries: [], newPosition: 0 };
  }

  const cursor = readCursor();
  const buf = fs.readFileSync(eventQueuePath);

  // Read from cursor position (byte-based to match writeCursor)
  const remaining = buf.subarray(cursor).toString('utf8');
  const lines = remaining
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as QueueEntry);

  const newPosition = buf.length;

  return { entries: lines, newPosition };
}

/**
 * Execute a queue entry (spawn command with body piped to stdin)
 */
async function executeEntry(entry: QueueEntry): Promise<{
  exitCode: number;
  durationMs: number;
}> {
  const startTime = Date.now();

  return new Promise((resolve) => {
    // Parse command and args
    const parts = entry.cmd.split(/\s+/);
    const command = parts[0];
    const args = parts.slice(1);

    const proc = spawn(command, args, {
      stdio: ['pipe', 'inherit', 'inherit'],
      shell: true,
    });

    // Pipe body as JSON to stdin
    const bodyJson = JSON.stringify(entry.body);
    proc.stdin.write(bodyJson);
    proc.stdin.end();

    // Setup timeout
    const timeout = setTimeout(() => {
      proc.kill('SIGTERM');
    }, entry.timeoutMs);

    proc.on('exit', (code) => {
      clearTimeout(timeout);
      const exitCode = code ?? -1;
      const durationMs = Date.now() - startTime;
      resolve({ exitCode, durationMs });
    });

    proc.on('error', () => {
      clearTimeout(timeout);
      const durationMs = Date.now() - startTime;
      resolve({ exitCode: -1, durationMs });
    });
  });
}

/**
 * Process one batch of queue entries
 */
async function processBatch(): Promise<void> {
  const { entries, newPosition } = readEntriesFromCursor();

  for (const entry of entries) {
    try {
      const { exitCode, durationMs } = await executeEntry(entry);

      // Log to event log
      logEvent({
        event: entry.event,
        matched: true,
        exitCode,
        durationMs,
      });
    } catch {
      // Log error but continue (errors are ignored per spec)
      logEvent({
        event: entry.event,
        matched: true,
        exitCode: -1,
        durationMs: 0,
      });
    }
  }

  // Update cursor
  if (entries.length > 0) {
    writeCursor(newPosition);
  }
}

/**
 * Start the queue drain loop
 */
export function startQueueProcessor(): void {
  setInterval(
    () => {
      void processBatch();
    },
    5000, // Check every 5 seconds
  );

  // Process immediately on start
  void processBatch();
}
