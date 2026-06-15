/**
 * In-memory pending magic link state with TTL.
 * @packageDocumentation
 */

import { createTtlStateMap } from './ttlStateMap.js';

/** Data stored for a pending magic link token. */
export interface PendingMagicLink {
  email: string;
  returnTo?: string;
}

const map = createTtlStateMap<PendingMagicLink>(10 * 60 * 1000);

/** Store a pending magic link token with automatic 10-minute TTL. */
export function storeMagicToken(token: string, data: PendingMagicLink): void {
  map.store(token, data);
}

/** Consume a pending magic link token (single-use). Returns null if not found or expired. */
export function consumeMagicToken(token: string): PendingMagicLink | null {
  return map.consume(token);
}

/** Clear all pending entries (for testing). */
export function clearAllMagicTokens(): void {
  map.clearAll();
}
