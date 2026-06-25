/**
 * Event queue service tests.
 *
 * Tests the publicly exported `enqueue` and `appendEvent` functions
 * against temp directories with a mocked config singleton.
 *
 * The drain loop (`processBatch`, concurrency, `drainLoop`) spawns child
 * processes and runs as an infinite loop — these are integration-test
 * concerns covered by the event gateway E2E tests.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { QueueEntry } from '../config/types.js';

// Mock getConfig to return temp paths
let tmpDir: string;

const mockConfig = () => ({
  eventsLog: path.join(tmpDir, 'webhook-events.jsonl'),
  eventQueuePath: path.join(tmpDir, 'event-queue.jsonl'),
  eventQueueCursorPath: path.join(tmpDir, 'event-queue.cursor'),
  eventQueueConcurrency: 3,
});

vi.mock('../config/index.js', () => ({
  getConfig: () => mockConfig(),
}));

// Import after mock
const { appendEvent, enqueue } = await import('./eventQueue.js');

describe('enqueue', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eq-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates queue file and writes a valid JSONL entry', () => {
    enqueue('test-event', 'node handler.js', { key: 'value' }, 30000);

    const queuePath = path.join(tmpDir, 'event-queue.jsonl');
    expect(fs.existsSync(queuePath)).toBe(true);

    const content = fs.readFileSync(queuePath, 'utf-8').trim();
    const entry = JSON.parse(content) as QueueEntry;

    expect(entry.event).toBe('test-event');
    expect(entry.cmd).toBe('node handler.js');
    expect(entry.body).toEqual({ key: 'value' });
    expect(entry.timeoutMs).toBe(30000);
    expect(entry.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('appends multiple entries as separate JSONL lines', () => {
    enqueue('event-1', 'cmd1', { a: 1 }, 10000);
    enqueue('event-2', 'cmd2', { b: 2 }, 20000);
    enqueue('event-3', 'cmd3', { c: 3 }, 30000);

    const content = fs.readFileSync(
      path.join(tmpDir, 'event-queue.jsonl'),
      'utf-8',
    );
    const lines = content.split('\n').filter((l) => l.trim());

    expect(lines).toHaveLength(3);

    const entries = lines.map((l) => JSON.parse(l) as QueueEntry);
    expect(entries[0].event).toBe('event-1');
    expect(entries[1].event).toBe('event-2');
    expect(entries[2].event).toBe('event-3');
  });

  it('preserves complex body structures', () => {
    const body = {
      string: 'test',
      number: 42,
      boolean: true,
      null: null,
      array: [1, 'two', { three: 3 }],
      nested: { deep: { deeper: { value: 'found' } } },
    };

    enqueue('complex', 'cmd', body, 5000);

    const content = fs.readFileSync(
      path.join(tmpDir, 'event-queue.jsonl'),
      'utf-8',
    );
    const entry = JSON.parse(content.trim()) as QueueEntry;
    expect(entry.body).toEqual(body);
  });
});

describe('appendEvent', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eq-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('writes to the events log with a timestamp', () => {
    appendEvent({ type: 'webhook', source: 'github' });

    const logPath = path.join(tmpDir, 'webhook-events.jsonl');
    expect(fs.existsSync(logPath)).toBe(true);

    const content = fs.readFileSync(logPath, 'utf-8').trim();
    const entry = JSON.parse(content) as Record<string, unknown>;

    expect(entry.at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(entry.type).toBe('webhook');
    expect(entry.source).toBe('github');
  });

  it('appends multiple events as separate lines', () => {
    appendEvent({ event: 'first' });
    appendEvent({ event: 'second' });

    const content = fs.readFileSync(
      path.join(tmpDir, 'webhook-events.jsonl'),
      'utf-8',
    );
    const lines = content.split('\n').filter((l) => l.trim());

    expect(lines).toHaveLength(2);
    expect((JSON.parse(lines[0]) as Record<string, unknown>).event).toBe(
      'first',
    );
    expect((JSON.parse(lines[1]) as Record<string, unknown>).event).toBe(
      'second',
    );
  });
});
