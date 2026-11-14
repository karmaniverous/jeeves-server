// @vitest-environment node
/**
 * `GET /api/events` over a real event log with a torn line (#302): the
 * reader skips the malformed line and answers 200 with the valid entries.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let dir: string;

vi.mock('../../config/index.js', () => ({
  getConfig: () => ({ eventLogPath: path.join(dir, 'event-log.jsonl') }),
}));

const { eventsHandlers } = await import('./events.js');

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'events-'));
  vi.spyOn(console, 'debug').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('listEvents over a torn event log', () => {
  it('answers 200 with the valid entries (torn and ts-less lines skipped), newest first', async () => {
    const a = { ts: '2026-11-14T00:00:00Z', event: 'a', matched: true };
    const b = { ts: '2026-11-14T00:00:01Z', event: null, matched: false };
    fs.writeFileSync(
      path.join(dir, 'event-log.jsonl'),
      `${JSON.stringify(a)}\n{"ts":"2026-11\n{"no":"ts"}\n${JSON.stringify(b)}\n{"torn`,
    );
    const reply = await eventsHandlers.listEvents(
      { params: {}, query: {}, body: {} },
      {} as never,
    );
    expect(reply).toEqual({ status: 200, body: [b, a] });
  });
});
