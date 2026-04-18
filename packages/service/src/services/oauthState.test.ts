/**
 * Tests for in-memory OAuth2 pending auth state management.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { PendingAuth } from './oauthState.js';
import {
  clearAllPending,
  consumePending,
  credentialPath,
  storePending,
} from './oauthState.js';

const makePending = (overrides?: Partial<PendingAuth>): PendingAuth => ({
  tokenUrl: 'https://provider.example.com/token',
  clientId: 'test-client',
  clientSecret: 'test-secret',
  redirectUri: 'https://jeeves.example.com/oauth/callback',
  provider: 'test-provider',
  account: 'test-account',
  ...overrides,
});

describe('oauthState', () => {
  afterEach(() => {
    clearAllPending();
    vi.useRealTimers();
  });

  it('stores and consumes pending auth', () => {
    const data = makePending();
    storePending('state-1', data);
    const result = consumePending('state-1');
    expect(result).toEqual(data);
  });

  it('returns null for unknown state', () => {
    expect(consumePending('nonexistent')).toBeNull();
  });

  it('consumes only once (single-use)', () => {
    storePending('state-2', makePending());
    expect(consumePending('state-2')).not.toBeNull();
    expect(consumePending('state-2')).toBeNull();
  });

  it('stores entry with codeVerifier', () => {
    const data = makePending({ codeVerifier: 'some-verifier' });
    storePending('state-3', data);
    const result = consumePending('state-3');
    expect(result?.codeVerifier).toBe('some-verifier');
  });

  it('auto-deletes after 10-minute TTL', () => {
    vi.useFakeTimers();
    storePending('state-ttl', makePending());

    // Just before expiry — still available
    vi.advanceTimersByTime(10 * 60 * 1000 - 1);
    expect(consumePending('state-ttl')).not.toBeNull();

    // Store again and let it expire
    storePending('state-ttl2', makePending());
    vi.advanceTimersByTime(10 * 60 * 1000 + 1);
    expect(consumePending('state-ttl2')).toBeNull();
  });

  it('credentialPath returns correct format', () => {
    const result = credentialPath('/var/credentials', 'github', 'myuser');
    // path.join normalizes separators per platform, so check the segments
    expect(result).toMatch(/github-myuser-oauth2\.json$/);
    expect(result).toContain('credentials');
  });

  it('replaces existing state on re-store', () => {
    storePending('state-dup', makePending({ provider: 'first' }));
    storePending('state-dup', makePending({ provider: 'second' }));
    const result = consumePending('state-dup');
    expect(result?.provider).toBe('second');
  });
});
