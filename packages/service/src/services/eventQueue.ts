/**
 * The durable event queue file and the webhook events log: appends (with append hygiene), the in-process queue mutex (the receiver appends under it; the processor takes it only to rotate), and the queue entry check.
 *
 * @packageDocumentation
 */

import { getConfig } from '../config/index.js';
import type { QueueEntry } from '../config/types.js';
import { withFileLock } from '../util/fileMutex.js';
import { nowIso } from '../util/formatters.js';
import { appendJsonlLine } from '../util/jsonl.js';

/**
 * Append a JSON object as a line to the webhook events log
 * (`webhook-events.jsonl`: exports, key rotations, queue incidents). This
 * is separate from the Event Gateway event log.
 *
 * @param event - The event.
 */
export function appendEvent(event: Record<string, unknown>): void {
  appendJsonlLine(getConfig().eventsLog, { at: nowIso(), ...event });
}

/**
 * Run `fn` holding the queue mutex (one per queue file, in-process).
 *
 * @param fn - The work.
 * @returns Its result.
 */
export function withQueueLock<T>(fn: () => Promise<T>): Promise<T> {
  return withFileLock(getConfig().eventQueuePath, fn);
}

/**
 * Append a queue entry to the durable queue, under the queue mutex.
 *
 * @param event - Matched event name.
 * @param cmd - Command to run.
 * @param body - Body piped to the command.
 * @param timeoutMs - Command timeout.
 */
export async function enqueue(
  event: string,
  cmd: string,
  body: Record<string, unknown>,
  timeoutMs: number,
): Promise<void> {
  const entry: QueueEntry = { ts: nowIso(), event, cmd, body, timeoutMs };
  await withQueueLock(() => {
    appendJsonlLine(getConfig().eventQueuePath, entry);
    return Promise.resolve();
  });
}

/**
 * Whether a parsed queue line is a queue entry.
 *
 * @param value - The parsed line.
 * @returns True when it has the entry's fields.
 */
export function isQueueEntry(
  value: Record<string, unknown>,
): value is Record<string, unknown> & QueueEntry {
  return (
    typeof value.event === 'string' &&
    typeof value.cmd === 'string' &&
    value.body !== null &&
    typeof value.body === 'object' &&
    typeof value.timeoutMs === 'number'
  );
}
