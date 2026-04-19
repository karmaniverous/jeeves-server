/**
 * In-memory pending OAuth2 authorization state with TTL.
 * Keyed by cryptographically random `state` parameter.
 */

import path from 'node:path';

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

const TTL_MS = 10 * 60 * 1000; // 10 minutes

const pendingMap = new Map<string, PendingAuth>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

/** Store a pending auth entry with automatic 10-minute TTL. */
export function storePending(state: string, data: PendingAuth): void {
  // Clear any existing timer for this state
  const existing = timers.get(state);
  if (existing) clearTimeout(existing);

  pendingMap.set(state, data);
  timers.set(
    state,
    setTimeout(() => {
      pendingMap.delete(state);
      timers.delete(state);
    }, TTL_MS),
  );
}

/** Consume a pending auth entry (single-use). Returns null if not found or expired. */
export function consumePending(state: string): PendingAuth | null {
  const data = pendingMap.get(state);
  if (!data) return null;

  pendingMap.delete(state);
  const timer = timers.get(state);
  if (timer) clearTimeout(timer);
  timers.delete(state);

  return data;
}

/** Clear all pending entries (for testing). */
export function clearAllPending(): void {
  for (const timer of timers.values()) clearTimeout(timer);
  pendingMap.clear();
  timers.clear();
}
