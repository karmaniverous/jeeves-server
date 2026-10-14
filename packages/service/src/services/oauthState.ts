/**
 * In-memory pending OAuth2 authorization state with TTL.
 * Keyed by cryptographically random `state` parameter.
 */

import path from 'node:path';

import { createTtlStateMap } from './ttlStateMap.js';

/**
 * Allowed characters for OAuth provider and account names: letters, digits,
 * `.`, `_`, `-`, `@` and `+` (so email-style accounts work). Path separators,
 * NUL and other control characters, and empty values never match.
 */
const CREDENTIAL_NAME_RE = /^[A-Za-z0-9._@+-]+$/u;

/** Error returned when a provider or account name is rejected. */
export const INVALID_CREDENTIAL_NAME_ERROR =
  'provider and account may only contain letters, digits, ".", "_", "-", "@" and "+", and may not be "." or ".."';

/**
 * True when `value` is safe in a credential file name: only the allowed
 * characters, and not `.` or `..`. With separators excluded, a whole-value
 * `..` is the only way to form a `..` path segment.
 */
export function isValidCredentialName(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    CREDENTIAL_NAME_RE.test(value) &&
    value !== '.' &&
    value !== '..'
  );
}

/**
 * Build the credential file path for a provider/account pair. Throws when
 * either name is invalid or the path would leave `credentialDir`.
 */
export function credentialPath(
  credentialDir: string,
  provider: string,
  account: string,
): string {
  if (!isValidCredentialName(provider) || !isValidCredentialName(account)) {
    throw new Error(INVALID_CREDENTIAL_NAME_ERROR);
  }
  const dir = path.resolve(credentialDir);
  const file = path.resolve(dir, `${provider}-${account}-oauth2.json`);
  const rel = path.relative(dir, file);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error('Credential path escapes the credential directory');
  }
  return file;
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
