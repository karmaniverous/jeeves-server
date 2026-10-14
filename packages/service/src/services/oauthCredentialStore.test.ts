/**
 * Tests for the OAuth2 credential store: expiry, persistence and refresh.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  credentialExists,
  type CredentialFile,
  isExpired,
  readCredential,
  refreshCredential,
  remainingSeconds,
  writeCredential,
} from './oauthCredentialStore.js';

const NOW = new Date('2026-10-14T12:00:00.000Z');

function cred(overrides: Partial<CredentialFile> = {}): CredentialFile {
  return {
    provider: 'github',
    account: 'me',
    access_token: 'old-token',
    refresh_token: 'old-refresh',
    expires_in: 3600,
    token_type: 'Bearer',
    scope: 'repo',
    obtained_at: NOW.toISOString(),
    tokenUrl: 'https://auth.example.com/token',
    clientId: 'cid',
    clientSecret: 'secret',
    ...overrides,
  };
}

describe('expiry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('is not expired, with the remaining seconds, inside its lifetime', () => {
    vi.setSystemTime(new Date(NOW.getTime() + 600_000));
    expect(isExpired(cred())).toBe(false);
    expect(remainingSeconds(cred())).toBe(3000);
  });

  it('is expired, with zero seconds left, after its lifetime', () => {
    vi.setSystemTime(new Date(NOW.getTime() + 3_601_000));
    expect(isExpired(cred())).toBe(true);
    expect(remainingSeconds(cred())).toBe(0);
  });

  it('never expires without expires_in', () => {
    vi.setSystemTime(new Date(NOW.getTime() + 10 ** 10));
    expect(isExpired(cred({ expires_in: undefined }))).toBe(false);
    expect(remainingSeconds(cred({ expires_in: undefined }))).toBeNull();
  });
});

describe('persistence', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jeeves-oauth-store-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('writes atomically and reads back the same credential', async () => {
    const file = path.join(dir, 'github-me-oauth2.json');
    expect(await credentialExists(file)).toBe(false);

    await writeCredential(file, cred());

    expect(await credentialExists(file)).toBe(true);
    expect(fs.existsSync(`${file}.tmp`)).toBe(false);
    expect(await readCredential(file)).toEqual(cred());
  });

  it('throws when the file is not JSON', async () => {
    const file = path.join(dir, 'bad-oauth2.json');
    fs.writeFileSync(file, 'not json');
    await expect(readCredential(file)).rejects.toThrow();
  });
});

describe('refreshCredential', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubFetch(response: Response) {
    const fetchMock = vi.fn().mockResolvedValue(response);
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  it('posts the refresh grant and merges the new token', async () => {
    const fetchMock = stubFetch(
      new Response(
        JSON.stringify({
          access_token: 'new-token',
          refresh_token: 'new-refresh',
          expires_in: 7200,
          scope: 'repo user',
        }),
      ),
    );

    const updated = await refreshCredential(cred(), 'old-refresh');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://auth.example.com/token');
    expect(
      Object.fromEntries(new URLSearchParams(init.body as string)),
    ).toEqual({
      grant_type: 'refresh_token',
      refresh_token: 'old-refresh',
      client_id: 'cid',
      client_secret: 'secret',
    });
    expect(updated).toMatchObject({
      access_token: 'new-token',
      refresh_token: 'new-refresh',
      expires_in: 7200,
      scope: 'repo user',
      token_type: 'Bearer',
    });
  });

  it('keeps the stored refresh token, expiry and scope when omitted', async () => {
    stubFetch(new Response(JSON.stringify({ access_token: 'new-token' })));

    const updated = await refreshCredential(cred(), 'old-refresh');

    expect(updated).toMatchObject({
      access_token: 'new-token',
      refresh_token: 'old-refresh',
      expires_in: 3600,
      scope: 'repo',
    });
  });

  it('returns null when the token endpoint refuses', async () => {
    stubFetch(new Response('denied', { status: 400 }));
    expect(await refreshCredential(cred(), 'old-refresh')).toBeNull();
  });
});
