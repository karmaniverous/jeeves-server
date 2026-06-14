/**
 * In-memory pending OAuth2 authorization state with TTL.
 * Keyed by cryptographically random `state` parameter.
 */

import path from 'node:path';

import { createTtlStateMap } from './ttlStateMap.js';

/** Build the credential file path for a provider/account pair. */
export function credentialPath(
  credentialDir: string,
  provider: string,
  account: string,
): string {
  return path.join(credentialDir, `${provider}-${account}-oauth2.json`);
}

/** Data stored for a pending OAuth2 authorization flow. */
export interface PendingAuth {
  codeVerifier?: string;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  provider: string;
  account: string;
}

const map = createTtlStateMap<PendingAuth>(10 * 60 * 1000);

/** Store a pending auth entry with automatic 10-minute TTL. */
export function storePending(state: string, data: PendingAuth): void {
  map.store(state, data);
}

/** Consume a pending auth entry (single-use). Returns null if not found or expired. */
export function consumePending(state: string): PendingAuth | null {
  return map.consume(state);
}

/** Clear all pending entries (for testing). */
export function clearAllPending(): void {
  map.clearAll();
}
