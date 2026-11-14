import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { runPool } from './queuePool.js';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

const sleep = (ms: number) =>
  new Promise<void>((r) => {
    setTimeout(r, ms);
  });

describe('runPool', () => {
  it('starts the next task as soon as any slot frees (#285)', async () => {
    const started: Record<string, number> = {};
    const t0 = Date.now();
    const tasks = [
      { id: 'a', ms: 5000 },
      { id: 'b', ms: 1000 },
      { id: 'c', ms: 1000 },
    ];
    const done = runPool(tasks, 2, async ({ id, ms }) => {
      started[id] = Date.now() - t0;
      await sleep(ms);
    });
    await vi.advanceTimersByTimeAsync(999);
    expect(started).toEqual({ a: 0, b: 0 });
    await vi.advanceTimersByTimeAsync(1);
    expect(started.c).toBe(1000);
    await vi.advanceTimersByTimeAsync(4000);
    await done;
  });

  it('never runs more than the limit at once, and waits for all to settle', async () => {
    let running = 0;
    let peak = 0;
    let finished = 0;
    const done = runPool([1, 2, 3, 4, 5], 3, async (n) => {
      running += 1;
      peak = Math.max(peak, running);
      await sleep(n * 100);
      running -= 1;
      finished += 1;
    });
    await vi.runAllTimersAsync();
    await done;
    expect(peak).toBe(3);
    expect(finished).toBe(5);
  });

  it('keeps going when a task rejects, and treats a limit below 1 as 1', async () => {
    const seen: number[] = [];
    const done = runPool([1, 2, 3], 0, async (n) => {
      seen.push(n);
      await sleep(10);
      if (n === 1) throw new Error('boom');
    });
    await vi.runAllTimersAsync();
    await expect(done).resolves.toBeUndefined();
    expect(seen).toEqual([1, 2, 3]);
  });
});
