// @vitest-environment node
/**
 * The drain loop (fake timers): continues at once after a batch, sleeps
 * 5 s when idle, and survives an iteration that throws. Malformed lines
 * stand in for entries so no command runs.
 */
import fs from 'node:fs';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  incidents,
  makeQueueFixture,
  type QueueFixture,
} from '../testing/queueFixture.js';

let fx: QueueFixture;

vi.mock('../config/index.js', () => ({ getConfig: () => fx }));

beforeEach(() => {
  fx = makeQueueFixture();
  vi.useFakeTimers();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  fs.rmSync(fx.dir, { recursive: true, force: true });
});

describe('startQueueProcessor', () => {
  it('drains, sleeps when idle, and survives a failing iteration', async () => {
    const { startQueueProcessor } = await import('./queueProcessor.js');
    fs.writeFileSync(fx.eventQueuePath, 'bad 1\n');
    startQueueProcessor();
    await vi.advanceTimersByTimeAsync(0);
    expect(incidents(fx, 'queue_parse_error')).toHaveLength(1);

    // Idle: nothing new until the 5 s poll.
    fs.appendFileSync(fx.eventQueuePath, 'bad 2\n');
    await vi.advanceTimersByTimeAsync(4999);
    expect(incidents(fx, 'queue_parse_error')).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(incidents(fx, 'queue_parse_error')).toHaveLength(2);

    // A cursor that can't be written: the iteration fails, the loop goes on.
    fs.rmSync(fx.eventQueueCursorPath);
    fs.mkdirSync(fx.eventQueueCursorPath);
    fs.appendFileSync(fx.eventQueuePath, 'bad 3\n');
    await vi.advanceTimersByTimeAsync(5000);
    expect(console.error).toHaveBeenCalledWith(
      '[event-queue] drain error:',
      expect.any(String),
    );
    fs.rmSync(fx.eventQueueCursorPath, { recursive: true });
    await vi.advanceTimersByTimeAsync(5000);
    // The missing cursor processes the queue from 0 again (new install).
    expect(incidents(fx, 'queue_parse_error').length).toBeGreaterThan(3);
  });

  it('keeps going when a queue incident cannot be recorded', async () => {
    const { drainOnce } = await import('./queueProcessor.js');
    fs.mkdirSync(fx.eventsLog);
    fs.writeFileSync(fx.eventQueuePath, 'bad\n');
    await expect(drainOnce()).resolves.toBe(true);
    expect(console.error).toHaveBeenCalledWith(
      '[event-queue] could not record',
      'queue_parse_error',
      expect.anything(),
    );
  });
});
