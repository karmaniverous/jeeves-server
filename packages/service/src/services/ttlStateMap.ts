/**
 * Generic in-memory TTL state map.
 *
 * Stores entries keyed by string with automatic expiry.
 * Used by both OAuth state and magic link token stores.
 *
 * @packageDocumentation
 */

/** A TTL-managed state map instance. */
export interface TtlStateMap<T> {
  /** Store an entry with automatic TTL expiry. */
  store(key: string, data: T): void;
  /** Consume an entry (single-use). Returns null if not found or expired. */
  consume(key: string): T | null;
  /** Clear all entries. */
  clearAll(): void;
}

/**
 * Create a new TTL state map.
 *
 * @param ttlMs - Time-to-live in milliseconds.
 * @returns A TtlStateMap instance.
 */
export function createTtlStateMap<T>(ttlMs: number): TtlStateMap<T> {
  const dataMap = new Map<string, T>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  return {
    store(key: string, data: T): void {
      const existing = timers.get(key);
      if (existing) clearTimeout(existing);

      dataMap.set(key, data);
      timers.set(
        key,
        setTimeout(() => {
          dataMap.delete(key);
          timers.delete(key);
        }, ttlMs),
      );
    },

    consume(key: string): T | null {
      const data = dataMap.get(key);
      if (!data) return null;

      dataMap.delete(key);
      const timer = timers.get(key);
      if (timer) clearTimeout(timer);
      timers.delete(key);

      return data;
    },

    clearAll(): void {
      for (const timer of timers.values()) clearTimeout(timer);
      dataMap.clear();
      timers.clear();
    },
  };
}
