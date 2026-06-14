import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createTtlStateMap } from './ttlStateMap.js';

describe('createTtlStateMap', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('stores and consumes an entry', () => {
    const map = createTtlStateMap<{ value: string }>(60_000);
    map.store('key1', { value: 'hello' });
    expect(map.consume('key1')).toEqual({ value: 'hello' });
  });

  it('returns null for unknown keys', () => {
    const map = createTtlStateMap<string>(60_000);
    expect(map.consume('missing')).toBeNull();
  });

  it('consumes entries only once (single-use)', () => {
    const map = createTtlStateMap<number>(60_000);
    map.store('once', 42);
    expect(map.consume('once')).toBe(42);
    expect(map.consume('once')).toBeNull();
  });

  it('overwrites existing entries for the same key', () => {
    const map = createTtlStateMap<string>(60_000);
    map.store('dup', 'first');
    map.store('dup', 'second');
    expect(map.consume('dup')).toBe('second');
  });

  it('clearAll removes all entries', () => {
    const map = createTtlStateMap<string>(60_000);
    map.store('a', 'alpha');
    map.store('b', 'beta');
    map.clearAll();
    expect(map.consume('a')).toBeNull();
    expect(map.consume('b')).toBeNull();
  });

  describe('TTL behavior', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it('entries survive before TTL expires', () => {
      const map = createTtlStateMap<string>(10_000);
      map.store('timed', 'value');
      vi.advanceTimersByTime(9_999);
      expect(map.consume('timed')).toBe('value');
    });

    it('entries expire after TTL', () => {
      const map = createTtlStateMap<string>(10_000);
      map.store('timed', 'value');
      vi.advanceTimersByTime(10_001);
      expect(map.consume('timed')).toBeNull();
    });

    it('overwriting resets the TTL', () => {
      const map = createTtlStateMap<string>(10_000);
      map.store('reset', 'v1');
      vi.advanceTimersByTime(7_000);
      map.store('reset', 'v2');
      vi.advanceTimersByTime(7_000); // 14s total, but only 7s since overwrite
      expect(map.consume('reset')).toBe('v2');
    });
  });
});
