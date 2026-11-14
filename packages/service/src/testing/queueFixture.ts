/**
 * Test fixture for the event queue processor: a temp directory with the queue, cursor, event log and webhook events log paths, helpers to write entries and read incidents, and a recording entry runner.
 *
 * @packageDocumentation
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type { QueueEntry } from '../config/types.js';

/** The paths and settings the processor reads from the config. */
export interface QueueFixture {
  dir: string;
  eventQueuePath: string;
  eventQueueCursorPath: string;
  eventLogPath: string;
  eventsLog: string;
  eventQueueConcurrency: number;
  eventLogPurgeMs: number;
}

/**
 * A fresh fixture in a new temp directory.
 *
 * @returns The fixture.
 */
export function makeQueueFixture(): QueueFixture {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'queue-'));
  const eventQueuePath = path.join(dir, 'event-queue.jsonl');
  return {
    dir,
    eventQueuePath,
    eventQueueCursorPath: `${eventQueuePath}.cursor`,
    eventLogPath: path.join(dir, 'event-log.jsonl'),
    eventsLog: path.join(dir, 'webhook-events.jsonl'),
    eventQueueConcurrency: 2,
    eventLogPurgeMs: 30 * 24 * 3600 * 1000,
  };
}

/**
 * A queue line for event `name`.
 *
 * @param name - The event name.
 * @returns The JSONL line, `\n`-terminated.
 */
export const queueLine = (name: string): string =>
  `${JSON.stringify({
    ts: '2026-11-14T00:00:00.000Z',
    event: name,
    cmd: 'true',
    body: { name },
    timeoutMs: 1000,
  } satisfies QueueEntry)}\n`;

/**
 * The webhook events log's entries of one kind.
 *
 * @param fx - The fixture.
 * @param kind - The incident kind.
 * @returns The entries.
 */
export function incidents(
  fx: QueueFixture,
  kind: string,
): Record<string, unknown>[] {
  if (!fs.existsSync(fx.eventsLog)) return [];
  return fs
    .readFileSync(fx.eventsLog, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Record<string, unknown>)
    .filter((e) => e.kind === kind);
}

/**
 * An entry runner that records the event names it ran.
 *
 * @returns The names, and the runner.
 */
export function recordingRunner(): {
  ran: string[];
  run: (entry: QueueEntry) => Promise<void>;
} {
  const ran: string[] = [];
  return {
    ran,
    run: (entry) => {
      ran.push(entry.event);
      return Promise.resolve();
    },
  };
}
