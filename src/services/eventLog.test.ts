/**
 * Event log service tests
 */

import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import type { EventLogEntry } from '../config/types.js';
import { nowIso } from '../util/formatters.js';

// Test helper functions (isolated from config system)
function parseJsonl(filePath: string): EventLogEntry[] {
  if (!fs.existsSync(filePath)) return [];

  const content = fs.readFileSync(filePath, 'utf8');
  return content
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as EventLogEntry);
}

function writeJsonl(filePath: string, entries: EventLogEntry[]): void {
  const content = entries.map((entry) => JSON.stringify(entry)).join('\n');
  fs.writeFileSync(filePath, content + '\n', 'utf8');
}

function purgeOldEntries(
  entries: EventLogEntry[],
  retentionMs: number,
): EventLogEntry[] {
  const cutoff = new Date(Date.now() - retentionMs);
  return entries.filter((entry) => new Date(entry.ts) >= cutoff);
}

describe('eventLog', () => {
  it('should parse JSONL entries correctly', () => {
    const entry1: EventLogEntry = {
      ts: nowIso(),
      event: 'test-event',
      matched: true,
      exitCode: 0,
      durationMs: 123,
    };
    const entry2: EventLogEntry = {
      ts: nowIso(),
      event: null,
      matched: false,
      bodyPreview: '{"type":"unknown"}',
    };

    const tempFile = path.join(process.cwd(), 'test-temp-log.jsonl');
    writeJsonl(tempFile, [entry1, entry2]);

    const parsed = parseJsonl(tempFile);

    expect(parsed).toHaveLength(2);
    expect(parsed[0].event).toBe('test-event');
    expect(parsed[0].matched).toBe(true);
    expect(parsed[1].event).toBeNull();
    expect(parsed[1].matched).toBe(false);

    // Cleanup
    fs.unlinkSync(tempFile);
  });

  it('should purge entries older than retention period', () => {
    const now = Date.now();
    const retentionMs = 86400000; // 1 day

    const oldEntry: EventLogEntry = {
      ts: new Date(now - 2 * retentionMs).toISOString(),
      event: 'old-event',
      matched: true,
      exitCode: 0,
      durationMs: 100,
    };

    const recentEntry: EventLogEntry = {
      ts: new Date(now - 0.5 * retentionMs).toISOString(),
      event: 'recent-event',
      matched: true,
      exitCode: 0,
      durationMs: 200,
    };

    const currentEntry: EventLogEntry = {
      ts: new Date(now).toISOString(),
      event: 'current-event',
      matched: true,
      exitCode: 0,
      durationMs: 300,
    };

    const purged = purgeOldEntries(
      [oldEntry, recentEntry, currentEntry],
      retentionMs,
    );

    expect(purged).toHaveLength(2);
    expect(purged[0].event).toBe('recent-event');
    expect(purged[1].event).toBe('current-event');
  });

  it('should write JSONL with proper newline formatting', () => {
    const entries: EventLogEntry[] = [
      {
        ts: nowIso(),
        event: 'event1',
        matched: true,
        exitCode: 0,
        durationMs: 100,
      },
      {
        ts: nowIso(),
        event: 'event2',
        matched: true,
        exitCode: 1,
        durationMs: 200,
      },
    ];

    const tempFile = path.join(process.cwd(), 'test-temp-write.jsonl');
    writeJsonl(tempFile, entries);

    const content = fs.readFileSync(tempFile, 'utf8');
    const lines = content.split('\n').filter((line) => line.trim());

    expect(lines).toHaveLength(2);
    expect((JSON.parse(lines[0]) as EventLogEntry).event).toBe('event1');
    expect((JSON.parse(lines[1]) as EventLogEntry).event).toBe('event2');

    // Cleanup
    fs.unlinkSync(tempFile);
  });

  it('should handle empty log file', () => {
    const tempFile = path.join(process.cwd(), 'test-temp-empty.jsonl');
    const parsed = parseJsonl(tempFile);

    expect(parsed).toHaveLength(0);
  });
});
