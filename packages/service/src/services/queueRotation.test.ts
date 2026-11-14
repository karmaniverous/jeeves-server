// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';

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

async function load() {
  vi.resetModules();
  return {
    ...(await import('./queueProcessor.js')),
    ...(await import('./eventQueue.js')),
    ...(await import('./eventLog.js')),
  };
}

const read = (p: string) =>
  fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';

beforeEach(() => {
  fx = makeQueueFixture();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(fx.dir, { recursive: true, force: true });
});

describe('rotation', () => {
  const rotateBytes = 2 * queueLine('a').length - 1;

  it('rotates a caught-up queue over the threshold; nothing lost or replayed', async () => {
    const { drainOnce, enqueue } = await load();
    fs.writeFileSync(fx.eventQueuePath, queueLine('a') + queueLine('b'));
    const { ran, run } = recordingRunner();
    expect(await drainOnce({ run, rotateBytes })).toBe(true);
    // Caught up and over the threshold: rotate; an append waits for it.
    const rotating = drainOnce({ run, rotateBytes });
    const appended = enqueue('c', 'true', {}, 1000);
    await Promise.all([rotating, appended]);
    expect(read(`${fx.eventQueuePath}.1`)).toBe(
      queueLine('a') + queueLine('b'),
    );
    expect(read(fx.eventQueuePath)).toContain('"event":"c"');
    await drainOnce({ run, rotateBytes });
    await drainOnce({ run, rotateBytes });
    expect(ran).toEqual(['a', 'b', 'c']);
    expect(incidents(fx, 'queue_rewound')).toEqual([]);
    expect(incidents(fx, 'queue_cursor_reset')).toEqual([]);
  });

  it('does not rotate at or under the threshold, or when not caught up', async () => {
    const { drainOnce } = await load();
    fs.writeFileSync(fx.eventQueuePath, queueLine('a'));
    const { run } = recordingRunner();
    await drainOnce({ run, rotateBytes: queueLine('a').length });
    await drainOnce({ run, rotateBytes: queueLine('a').length });
    expect(fs.existsSync(`${fx.eventQueuePath}.1`)).toBe(false);
    fs.appendFileSync(fx.eventQueuePath, '{"torn');
    await drainOnce({ run, rotateBytes: 1 });
    expect(fs.existsSync(`${fx.eventQueuePath}.1`)).toBe(false);
  });

  it('retries a failed rename on a later idle iteration', async () => {
    const { drainOnce } = await load();
    fs.writeFileSync(fx.eventQueuePath, queueLine('a') + queueLine('b'));
    const { ran, run } = recordingRunner();
    await drainOnce({ run, rotateBytes });
    const rename = vi.spyOn(fs, 'renameSync');
    rename.mockImplementationOnce(() => {
      throw new Error('EBUSY');
    });
    await drainOnce({ run, rotateBytes });
    expect(fs.existsSync(`${fx.eventQueuePath}.1`)).toBe(false);
    await drainOnce({ run, rotateBytes });
    expect(fs.existsSync(`${fx.eventQueuePath}.1`)).toBe(true);
    expect(ran).toEqual(['a', 'b']);
  });

  it('replaces a previous .1 generation', async () => {
    const { drainOnce } = await load();
    fs.writeFileSync(`${fx.eventQueuePath}.1`, 'old\n');
    fs.writeFileSync(fx.eventQueuePath, queueLine('a') + queueLine('b'));
    const { run } = recordingRunner();
    await drainOnce({ run, rotateBytes });
    await drainOnce({ run, rotateBytes });
    expect(read(`${fx.eventQueuePath}.1`)).toBe(
      queueLine('a') + queueLine('b'),
    );
  });
});

describe('default entry runner', () => {
  it('runs the command and logs its exit code to the event log', async () => {
    const { drainOnce, getRecentEvents } = await load();
    const script = path.join(fx.dir, 'exit4.cjs');
    fs.writeFileSync(
      script,
      'process.stdin.resume(); process.stdin.on("end", () => process.exit(4));',
    );
    fs.writeFileSync(
      fx.eventQueuePath,
      `${JSON.stringify({ ts: 't', event: 'run', cmd: `node ${script}`, body: {}, timeoutMs: 10_000 })}\n`,
    );
    await drainOnce();
    const [entry] = getRecentEvents(1);
    expect(entry).toMatchObject({ event: 'run', matched: true, exitCode: 4 });
    expect(entry).not.toHaveProperty('timedOut');
  });

  it('records a timed-out command with timedOut', async () => {
    const { drainOnce, getRecentEvents } = await load();
    const script = path.join(fx.dir, 'hang.cjs');
    fs.writeFileSync(script, 'setInterval(() => {}, 1000);');
    fs.writeFileSync(
      fx.eventQueuePath,
      `${JSON.stringify({ ts: 't', event: 'hang', cmd: `node ${script}`, body: {}, timeoutMs: 300 })}\n`,
    );
    await drainOnce();
    expect(getRecentEvents(1)[0]).toMatchObject({
      event: 'hang',
      timedOut: true,
    });
  }, 15_000);
});
