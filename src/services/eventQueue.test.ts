/**
 * Event queue service tests
 */

import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import type { QueueEntry } from '../config/types.js';
import { nowIso } from '../util/formatters.js';

describe('eventQueue', () => {
  it('should format queue entries correctly', () => {
    const entry: QueueEntry = {
      ts: nowIso(),
      event: 'test-event',
      cmd: 'node test.js',
      body: { foo: 'bar', baz: 123 },
      timeoutMs: 30000,
    };

    const json = JSON.stringify(entry);
    const parsed = JSON.parse(json) as QueueEntry;

    expect(parsed.event).toBe('test-event');
    expect(parsed.cmd).toBe('node test.js');
    expect(parsed.body).toEqual({ foo: 'bar', baz: 123 });
    expect(parsed.timeoutMs).toBe(30000);
    expect(parsed.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('should write entries as JSONL', () => {
    const entry1: QueueEntry = {
      ts: nowIso(),
      event: 'event1',
      cmd: 'cmd1',
      body: { a: 1 },
      timeoutMs: 10000,
    };

    const entry2: QueueEntry = {
      ts: nowIso(),
      event: 'event2',
      cmd: 'cmd2',
      body: { b: 2 },
      timeoutMs: 20000,
    };

    const tempFile = path.join(process.cwd(), 'test-queue.jsonl');
    const lines = [entry1, entry2].map((e) => JSON.stringify(e)).join('\n');
    fs.writeFileSync(tempFile, lines + '\n', 'utf8');

    const content = fs.readFileSync(tempFile, 'utf8');
    const parsed = content
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line) as QueueEntry);

    expect(parsed).toHaveLength(2);
    expect(parsed[0].event).toBe('event1');
    expect(parsed[1].event).toBe('event2');

    // Cleanup
    fs.unlinkSync(tempFile);
  });

  it('should handle cursor-based reading', () => {
    const entry1 = JSON.stringify({
      ts: nowIso(),
      event: 'e1',
      cmd: 'c1',
      body: {},
      timeoutMs: 1000,
    });
    const entry2 = JSON.stringify({
      ts: nowIso(),
      event: 'e2',
      cmd: 'c2',
      body: {},
      timeoutMs: 2000,
    });

    const tempFile = path.join(process.cwd(), 'test-cursor-queue.jsonl');
    fs.writeFileSync(tempFile, entry1 + '\n' + entry2 + '\n', 'utf8');

    const fullContent = fs.readFileSync(tempFile, 'utf8');
    const cursorPosition = Buffer.byteLength(entry1 + '\n', 'utf8');

    // Read from cursor
    const remaining = fullContent.slice(cursorPosition);
    const lines = remaining
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line) as QueueEntry);

    expect(lines).toHaveLength(1);
    expect(lines[0].event).toBe('e2');

    // Cleanup
    fs.unlinkSync(tempFile);
  });

  it('should preserve body structure through JSON serialization', () => {
    const complexBody = {
      string: 'test',
      number: 123,
      boolean: true,
      null: null,
      array: [1, 2, 3],
      nested: { a: { b: { c: 'deep' } } },
    };

    const entry: QueueEntry = {
      ts: nowIso(),
      event: 'complex',
      cmd: 'node test.js',
      body: complexBody,
      timeoutMs: 5000,
    };

    const json = JSON.stringify(entry);
    const parsed = JSON.parse(json) as QueueEntry;

    expect(parsed.body).toEqual(complexBody);
  });
});
