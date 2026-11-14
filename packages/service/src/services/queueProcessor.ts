/**
 * The event queue processor: each iteration resolves the cursor, reads one bounded batch of complete lines, skips malformed lines, runs the entries in a pool of `eventQueueConcurrency`, and advances the cursor once the whole batch has settled (at-least-once delivery: a crash mid-batch re-runs the batch). When caught up on a queue over `ROTATE_BYTES`, it rotates the queue under the queue mutex.
 *
 * @packageDocumentation
 */

import fs from 'node:fs';

import { getConfig } from '../config/index.js';
import type { QueueEntry } from '../config/types.js';
import { nowIso } from '../util/formatters.js';
import { parseJsonObject } from '../util/jsonl.js';
import { runEventCommand } from './eventCommand.js';
import { logEvent } from './eventLog.js';
import { appendEvent, isQueueEntry, withQueueLock } from './eventQueue.js';
import { type QueueLine, readBatch } from './queueBatch.js';
import {
  cursorAt,
  fileSize,
  resolveCursor,
  writeCursor,
} from './queueCursor.js';
import { noteCursorEvent, noteOffset, noteParseError } from './queueHealth.js';
import { runPool } from './queuePool.js';

/** A caught-up queue larger than this is rotated to `<queue>.1`. */
export const ROTATE_BYTES = 64 * 1024 * 1024;

/** Idle sleep between iterations. */
const POLL_MS = 5000;

/** Runs one queue entry; never rejects. */
type RunEntry = (entry: QueueEntry) => Promise<void>;

/** Options of {@link drainOnce} (tests). */
export interface DrainOptions {
  /** Entry runner (default: the command, logged to the event log). */
  run?: RunEntry;
  /** Rotation threshold (default {@link ROTATE_BYTES}). */
  rotateBytes?: number;
}

/**
 * Record a queue incident in the webhook events log; a failure to record
 * (a full disk) is logged and doesn't stop the queue.
 *
 * @param event - The incident.
 */
function recordIncident(event: Record<string, unknown>): void {
  try {
    appendEvent(event);
  } catch (err) {
    console.error('[event-queue] could not record', event.kind, err);
  }
}

/**
 * Run an entry's command and log the result to the event log.
 *
 * @param entry - The entry.
 */
async function runEntry(entry: QueueEntry): Promise<void> {
  try {
    const { exitCode, durationMs, timedOut } = await runEventCommand(
      entry.cmd,
      entry.body,
      entry.timeoutMs,
    );
    logEvent({
      event: entry.event,
      matched: true,
      exitCode,
      durationMs,
      ...(timedOut ? { timedOut } : {}),
    });
  } catch (err) {
    console.error(`[event-queue] ${entry.event} failed:`, err);
  }
}

/**
 * Where this iteration starts. A cursor that can't be trusted resets to the
 * end of the queue (no replay); a truncated or replaced queue rewinds to 0.
 * Either is logged, recorded and written back at once.
 *
 * @returns The offset.
 */
function startOffset(queuePath: string, cursorPath: string): number {
  const { offset, outcome, reason } = resolveCursor(queuePath, cursorPath);
  if (outcome === 'reset' || outcome === 'rewound') {
    const kind = outcome === 'reset' ? 'queue_cursor_reset' : 'queue_rewound';
    const message = `[event-queue] ${kind}: ${reason ?? ''}; resuming at byte ${String(offset)}`;
    if (outcome === 'reset') console.error(message);
    else console.warn(message);
    recordIncident({ kind, offset, reason });
    noteCursorEvent(outcome, nowIso());
    writeCursor(cursorPath, cursorAt(queuePath, offset));
  }
  noteOffset(offset);
  return offset;
}

/**
 * The batch's entries; a malformed line is skipped, logged with its byte
 * offset and recorded (`queue_parse_error`, with a 200-character preview).
 *
 * @param lines - The batch's lines.
 * @returns The entries.
 */
function parseEntries(lines: QueueLine[]): QueueEntry[] {
  const entries: QueueEntry[] = [];
  for (const { offset, text } of lines) {
    if (!text.trim()) continue;
    const value = parseJsonObject(text);
    if (value && isQueueEntry(value)) {
      entries.push(value);
      continue;
    }
    console.warn(
      `[event-queue] skipping malformed queue line at byte ${String(offset)}`,
    );
    noteParseError();
    recordIncident({
      kind: 'queue_parse_error',
      offset,
      preview: text.slice(0, 200),
    });
  }
  return entries;
}

/**
 * Rotate a caught-up queue larger than `rotateBytes` to `<queue>.1` under
 * the queue mutex, then reset the cursor. A failed rename is retried on a
 * later idle iteration.
 */
async function maybeRotate(
  queuePath: string,
  cursorPath: string,
  offset: number,
  rotateBytes: number,
): Promise<void> {
  if (offset <= rotateBytes) return;
  await withQueueLock(() => {
    if (fileSize(queuePath) !== offset) return Promise.resolve();
    try {
      fs.renameSync(queuePath, `${queuePath}.1`);
    } catch (err) {
      console.warn('[event-queue] rotation skipped, will retry:', err);
      return Promise.resolve();
    }
    writeCursor(cursorPath, cursorAt(queuePath, 0));
    noteOffset(0);
    return Promise.resolve();
  });
}

/**
 * One iteration of the drain loop.
 *
 * @param options - Entry runner and rotation threshold (tests).
 * @returns True when a batch was read (the loop continues at once).
 */
export async function drainOnce(options: DrainOptions = {}): Promise<boolean> {
  const { run = runEntry, rotateBytes = ROTATE_BYTES } = options;
  const {
    eventQueuePath: queuePath,
    eventQueueCursorPath: cursorPath,
    eventQueueConcurrency,
  } = getConfig();
  const offset = startOffset(queuePath, cursorPath);
  const batch = readBatch(queuePath, offset);
  if (batch.lines.length === 0) {
    await maybeRotate(queuePath, cursorPath, offset, rotateBytes);
    return false;
  }
  await runPool(parseEntries(batch.lines), eventQueueConcurrency, run);
  writeCursor(cursorPath, cursorAt(queuePath, batch.end));
  noteOffset(batch.end);
  return true;
}

/**
 * The drain loop: never overlaps iterations, never dies (errors are
 * logged), sleeps only when idle.
 */
async function drainLoop(): Promise<void> {
  for (;;) {
    let busy = false;
    try {
      busy = await drainOnce();
    } catch (err) {
      console.error(
        '[event-queue] drain error:',
        err instanceof Error ? err.message : err,
      );
    }
    if (!busy) await new Promise<void>((r) => setTimeout(r, POLL_MS));
  }
}

/** Start the queue drain loop. */
export function startQueueProcessor(): void {
  void drainLoop();
}
