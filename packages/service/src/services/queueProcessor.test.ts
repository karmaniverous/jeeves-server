// @vitest-environment node
import fs from 'node:fs';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  incidents,
  makeQueueFixture,
  type QueueFixture,
  queueLine,
  recordingRunner,
} from '../testing/queueFixture.js';

let fx: QueueFixture;

vi.mock('../config/index.js', () => ({ getConfig: () => fx }));

/** Fresh modules (processor state, append hygiene) for each test. */
async function load() {
  vi.resetModules();
  return {
    ...(await import('./queueProcessor.js')),
    ...(await import('./queueHealth.js')),
    ...(await import('./eventQueue.js')),
    ...(await import('./eventLog.js')),
  };
}

const cursorOffset = () =>
  (
    JSON.parse(fs.readFileSync(fx.eventQueueCursorPath, 'utf8')) as {
      offset: number;
    }
  ).offset;

const size = () => fs.statSync(fx.eventQueuePath).size;

beforeEach(() => {
  fx = makeQueueFixture();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'debug').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(fx.dir, { recursive: true, force: true });
});

describe('drainOnce', () => {
  it('processes from 0 when the cursor is missing, then idles', async () => {
    const { drainOnce, getEventQueueHealth } = await load();
    fs.writeFileSync(fx.eventQueuePath, queueLine('a') + queueLine('b'));
    const { ran, run } = recordingRunner();
    expect(await drainOnce({ run })).toBe(true);
    expect(ran).toEqual(['a', 'b']);
    expect(cursorOffset()).toBe(size());
    expect(await drainOnce({ run })).toBe(false);
    expect(ran).toEqual(['a', 'b']);
    expect(getEventQueueHealth()).toEqual({
      offset: size(),
      size: size(),
      pendingBytes: 0,
      parseErrors: 0,
    });
  });

  it('idles on a missing queue', async () => {
    const { drainOnce } = await load();
    const { ran, run } = recordingRunner();
    expect(await drainOnce({ run })).toBe(false);
    expect(ran).toEqual([]);
  });

  it('leaves a torn last line until it is completed', async () => {
    const { drainOnce } = await load();
    const line = queueLine('b');
    fs.writeFileSync(fx.eventQueuePath, queueLine('a') + line.slice(0, 20));
    const { ran, run } = recordingRunner();
    await drainOnce({ run });
    expect(ran).toEqual(['a']);
    expect(cursorOffset()).toBe(queueLine('a').length);
    fs.appendFileSync(fx.eventQueuePath, line.slice(20));
    await drainOnce({ run });
    expect(ran).toEqual(['a', 'b']);
    expect(cursorOffset()).toBe(size());
  });

  it('skips a torn line followed by a new append, and runs the new entry', async () => {
    const { drainOnce, enqueue } = await load();
    fs.writeFileSync(fx.eventQueuePath, queueLine('a') + '{"torn":');
    await enqueue('c', 'true', {}, 1000);
    const { ran, run } = recordingRunner();
    await drainOnce({ run });
    expect(ran).toEqual(['a', 'c']);
    expect(incidents(fx, 'queue_parse_error')).toMatchObject([
      { offset: queueLine('a').length, preview: '{"torn":' },
    ]);
    expect(cursorOffset()).toBe(size());
  });

  it('skips a malformed middle line, records it and runs the rest', async () => {
    const { drainOnce, getEventQueueHealth } = await load();
    const bad = `not json ${'z'.repeat(300)}`;
    fs.writeFileSync(
      fx.eventQueuePath,
      `${queueLine('a')}${bad}\n{"event":"no cmd"}\n${queueLine('b')}`,
    );
    const { ran, run } = recordingRunner();
    await drainOnce({ run });
    expect(ran).toEqual(['a', 'b']);
    const errors = incidents(fx, 'queue_parse_error');
    expect(errors).toHaveLength(2);
    expect(errors[0]).toMatchObject({
      offset: queueLine('a').length,
      preview: bad.slice(0, 200),
    });
    expect(getEventQueueHealth().parseErrors).toBe(2);
    expect(cursorOffset()).toBe(size());
  });

  it.each([
    ['empty', ''],
    ['non-numeric', 'abc'],
    ['garbage', '\u0000\u00ff{{'],
  ])(
    'does not replay on an %s cursor, and records the reset',
    async (_l, text) => {
      const { drainOnce, getEventQueueHealth } = await load();
      fs.writeFileSync(fx.eventQueuePath, queueLine('a') + queueLine('b'));
      fs.writeFileSync(fx.eventQueueCursorPath, text);
      const { ran, run } = recordingRunner();
      await drainOnce({ run });
      expect(ran).toEqual([]);
      expect(cursorOffset()).toBe(size());
      expect(incidents(fx, 'queue_cursor_reset')).toHaveLength(1);
      expect(getEventQueueHealth().lastCursorReset).toMatch(/^\d{4}-/);
      fs.appendFileSync(fx.eventQueuePath, queueLine('c'));
      await drainOnce({ run });
      expect(ran).toEqual(['c']);
      expect(incidents(fx, 'queue_cursor_reset')).toHaveLength(1);
    },
  );

  it.each([
    ['truncated', () => queueLine('x')],
    ['replaced', () => queueLine('y') + queueLine('z')],
  ])('processes a %s queue from 0 and records the rewind', async (_l, next) => {
    const { drainOnce, getEventQueueHealth } = await load();
    fs.writeFileSync(fx.eventQueuePath, queueLine('a') + queueLine('b'));
    const { ran, run } = recordingRunner();
    await drainOnce({ run });
    fs.writeFileSync(fx.eventQueuePath, next());
    ran.length = 0;
    await drainOnce({ run });
    expect(ran.length).toBeGreaterThan(0);
    expect(ran).not.toContain('a');
    expect(incidents(fx, 'queue_rewound')).toHaveLength(1);
    expect(getEventQueueHealth().lastRewind).toMatch(/^\d{4}-/);
    expect(cursorOffset()).toBe(size());
  });

  it('neither rewinds nor replays a queue shorter than 64 bytes that grew', async () => {
    const { drainOnce } = await load();
    const short = '{"a":1}\n';
    fs.writeFileSync(fx.eventQueuePath, short);
    const { ran, run } = recordingRunner();
    await drainOnce({ run });
    fs.appendFileSync(fx.eventQueuePath, queueLine('b') + queueLine('c'));
    await drainOnce({ run });
    expect(ran).toEqual(['b', 'c']);
    expect(incidents(fx, 'queue_rewound')).toEqual([]);
  });

  it('advances the cursor only once the whole batch has settled', async () => {
    const { drainOnce } = await load();
    fs.writeFileSync(fx.eventQueuePath, queueLine('a') + queueLine('b'));
    let finish = () => {};
    const slow = new Promise<void>((r) => (finish = r));
    const done = drainOnce({
      run: (e) => (e.event === 'b' ? slow : Promise.resolve()),
    });
    await new Promise((r) => setTimeout(r, 20));
    expect(fs.existsSync(fx.eventQueueCursorPath)).toBe(false);
    finish();
    await done;
    expect(cursorOffset()).toBe(size());
  });

  it('survives the disk-full case: torn event-log line and empty cursor', async () => {
    const { drainOnce, getRecentEvents, logEvent } = await load();
    fs.writeFileSync(fx.eventQueuePath, queueLine('a') + queueLine('b'));
    fs.writeFileSync(fx.eventQueueCursorPath, '');
    const ok = { ts: new Date().toISOString(), event: 'a', matched: true };
    fs.writeFileSync(fx.eventLogPath, `${JSON.stringify(ok)}\n{"ts":"20`);
    const { ran, run } = recordingRunner();
    await expect(drainOnce({ run })).resolves.toBe(false);
    expect(ran).toEqual([]);
    expect(getRecentEvents(10)).toEqual([ok]);
    logEvent({ event: 'next', matched: true, exitCode: 0, durationMs: 1 });
    expect(getRecentEvents(10).map((e) => e.event)).toEqual(['next', 'a']);
  });
});
