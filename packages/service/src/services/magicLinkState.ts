/**
 * In-memory pending magic link state with TTL.
 * Keyed by cryptographically random token.
 *
 * Follows the same pattern as oauthState.ts but stores email addresses
 * instead of OAuth authorization data.
 *
 * @packageDocumentation
 */

const TTL_MS = 10 * 60 * 1000; // 10 minutes

/** Data stored for a pending magic link token. */
export interface PendingMagicLink {
  email: string;
}

const pendingMap = new Map<string, PendingMagicLink>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

/** Store a pending magic link token with automatic 10-minute TTL. */
export function storeMagicToken(token: string, data: PendingMagicLink): void {
  const existing = timers.get(token);
  if (existing) clearTimeout(existing);

  pendingMap.set(token, data);
  timers.set(
    token,
    setTimeout(() => {
      pendingMap.delete(token);
      timers.delete(token);
    }, TTL_MS),
  );
}

/** Consume a pending magic link token (single-use). Returns null if not found or expired. */
export function consumeMagicToken(token: string): PendingMagicLink | null {
  const data = pendingMap.get(token);
  if (!data) return null;

  pendingMap.delete(token);
  const timer = timers.get(token);
  if (timer) clearTimeout(timer);
  timers.delete(token);

  return data;
}

/** Clear all pending entries (for testing). */
export function clearAllMagicTokens(): void {
  for (const timer of timers.values()) clearTimeout(timer);
  pendingMap.clear();
  timers.clear();
}
