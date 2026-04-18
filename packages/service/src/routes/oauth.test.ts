/**
 * Tests for OAuth2 callback route (GET /oauth/callback).
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearAllPending, storePending } from '../services/oauthState.js';

let tmpDir: string;
let mockConfig: Record<string, unknown> | null = null;

vi.mock('../config/index.js', () => ({
  getConfig: () => mockConfig,
}));

const { oauthRoute } = await import('./oauth.js');

type Handler = (req: unknown, reply: unknown) => Promise<unknown>;

function buildFastify(): {
  routes: Record<string, { method: string; handler: Handler }>;
  instance: unknown;
} {
  const routes: Record<string, { method: string; handler: Handler }> = {};
  const instance = {
    get: (routePath: string, handler: Handler) => {
      routes[routePath] = { method: 'GET', handler };
    },
  };
  return { routes, instance };
}

interface ReplyCapture {
  statusCode: number;
  body: unknown;
  contentType: string;
}

function buildReply(): {
  reply: Record<string, unknown>;
  capture: ReplyCapture;
} {
  const capture: ReplyCapture = {
    statusCode: 200,
    body: null,
    contentType: '',
  };
  const reply = {
    code: (c: number) => {
      capture.statusCode = c;
      return reply;
    },
    send: (d: unknown) => {
      capture.body = d;
      return d;
    },
    type: (t: string) => {
      capture.contentType = t;
      return reply;
    },
  };
  return { reply, capture };
}

describe('GET /oauth/callback', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jeeves-oauth-cb-'));
    mockConfig = {
      oauth: {
        credentialDir: tmpDir,
        providers: {},
      },
    };
  });

  afterEach(() => {
    clearAllPending();
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  async function getHandler() {
    const { routes, instance } = buildFastify();
    await oauthRoute(instance as never, {});
    return routes['/oauth/callback'].handler;
  }

  it('returns 501 when oauth config absent', async () => {
    mockConfig = { oauth: null };
    const handler = await getHandler();
    const { reply, capture } = buildReply();
    const result = await handler({ query: {} }, reply);
    expect(capture.statusCode).toBe(501);
    expect(result).toContain('OAuth not configured');
  });

  it('renders error page when error param present', async () => {
    const handler = await getHandler();
    const { reply, capture } = buildReply();
    const result = await handler(
      {
        query: {
          error: 'access_denied',
          error_description: 'User denied access',
        },
      },
      reply,
    );
    expect(capture.statusCode).toBe(400);
    expect(result).toContain('User denied access');
    expect(capture.contentType).toBe('text/html');
  });

  it('renders error for expired/invalid state', async () => {
    const handler = await getHandler();
    const { reply, capture } = buildReply();
    const result = await handler(
      { query: { code: 'auth-code', state: 'nonexistent-state' } },
      reply,
    );
    expect(capture.statusCode).toBe(400);
    expect(result).toContain('expired or invalid');
  });

  it('renders error when missing code or state', async () => {
    const handler = await getHandler();
    const { reply, capture } = buildReply();
    const result = await handler({ query: { state: 'some-state' } }, reply);
    expect(capture.statusCode).toBe(400);
    expect(result).toContain('Missing code or state');
  });

  it('exchanges code and writes credential file on success', async () => {
    storePending('valid-state', {
      tokenUrl: 'https://provider.example.com/token',
      clientId: 'cid',
      clientSecret: 'csecret',
      redirectUri: 'https://jeeves.example.com/oauth/callback',
      provider: 'github',
      account: 'myuser',
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: 'new-access',
            token_type: 'Bearer',
            refresh_token: 'new-refresh',
            expires_in: 3600,
            scope: 'repo',
          }),
      }),
    );

    const handler = await getHandler();
    const { reply, capture } = buildReply();
    const result = await handler(
      { query: { code: 'auth-code', state: 'valid-state' } },
      reply,
    );
    expect(capture.statusCode).toBe(200);
    expect(result).toContain('Authorization complete');

    // Verify credential file was written
    const credPath = path.join(tmpDir, 'github-myuser-oauth2.json');
    expect(fs.existsSync(credPath)).toBe(true);

    const cred = JSON.parse(fs.readFileSync(credPath, 'utf8')) as Record<
      string,
      unknown
    >;
    expect(cred.access_token).toBe('new-access');
    expect(cred.refresh_token).toBe('new-refresh');
    expect(cred.provider).toBe('github');
    expect(cred.account).toBe('myuser');
    expect(cred.tokenUrl).toBe('https://provider.example.com/token');
    expect(cred.clientId).toBe('cid');
    expect(cred.clientSecret).toBe('csecret');
    expect(cred.obtained_at).toBeTruthy();

    vi.unstubAllGlobals();
  });

  it('renders error when token exchange fails (non-ok response)', async () => {
    storePending('fail-state', {
      tokenUrl: 'https://provider.example.com/token',
      clientId: 'cid',
      clientSecret: 'csecret',
      redirectUri: 'https://jeeves.example.com/oauth/callback',
      provider: 'github',
      account: 'myuser',
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        text: () => Promise.resolve('invalid_grant'),
      }),
    );

    const handler = await getHandler();
    const { reply, capture } = buildReply();
    const result = await handler(
      { query: { code: 'bad-code', state: 'fail-state' } },
      reply,
    );
    expect(capture.statusCode).toBe(502);
    expect(result).toContain('invalid_grant');

    vi.unstubAllGlobals();
  });

  it('renders error when token exchange throws', async () => {
    storePending('throw-state', {
      tokenUrl: 'https://provider.example.com/token',
      clientId: 'cid',
      clientSecret: 'csecret',
      redirectUri: 'https://jeeves.example.com/oauth/callback',
      provider: 'github',
      account: 'myuser',
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('Network error')),
    );

    const handler = await getHandler();
    const { reply, capture } = buildReply();
    const result = await handler(
      { query: { code: 'code', state: 'throw-state' } },
      reply,
    );
    expect(capture.statusCode).toBe(502);
    expect(result).toContain('Network error');

    vi.unstubAllGlobals();
  });

  it('state is single-use (consumed after first callback)', async () => {
    storePending('once-state', {
      tokenUrl: 'https://provider.example.com/token',
      clientId: 'cid',
      clientSecret: 'csecret',
      redirectUri: 'https://jeeves.example.com/oauth/callback',
      provider: 'github',
      account: 'myuser',
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({ access_token: 'tok', token_type: 'Bearer' }),
      }),
    );

    const handler = await getHandler();

    // First call succeeds
    const { reply: r1, capture: c1 } = buildReply();
    await handler({ query: { code: 'code', state: 'once-state' } }, r1);
    expect(c1.statusCode).toBe(200);

    // Second call with same state fails
    const { reply: r2, capture: c2 } = buildReply();
    const result2 = await handler(
      { query: { code: 'code', state: 'once-state' } },
      r2,
    );
    expect(c2.statusCode).toBe(400);
    expect(result2).toContain('expired or invalid');

    vi.unstubAllGlobals();
  });

  it('creates credential directory if it does not exist', async () => {
    const nestedDir = path.join(tmpDir, 'nested', 'creds');
    (mockConfig as Record<string, unknown>).oauth = {
      credentialDir: nestedDir,
      providers: {},
    };

    storePending('dir-state', {
      tokenUrl: 'https://provider.example.com/token',
      clientId: 'cid',
      clientSecret: 'csecret',
      redirectUri: 'https://jeeves.example.com/oauth/callback',
      provider: 'test',
      account: 'user',
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({ access_token: 'tok', token_type: 'Bearer' }),
      }),
    );

    const handler = await getHandler();
    const { reply, capture } = buildReply();
    await handler({ query: { code: 'code', state: 'dir-state' } }, reply);
    expect(capture.statusCode).toBe(200);
    expect(fs.existsSync(path.join(nestedDir, 'test-user-oauth2.json'))).toBe(
      true,
    );

    vi.unstubAllGlobals();
  });

  it('includes PKCE code_verifier in token exchange', async () => {
    storePending('pkce-state', {
      tokenUrl: 'https://provider.example.com/token',
      clientId: 'cid',
      clientSecret: 'csecret',
      redirectUri: 'https://jeeves.example.com/oauth/callback',
      provider: 'github',
      account: 'myuser',
      codeVerifier: 'my-code-verifier',
    });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ access_token: 'tok', token_type: 'Bearer' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const handler = await getHandler();
    const { reply } = buildReply();
    await handler({ query: { code: 'code', state: 'pkce-state' } }, reply);

    // Verify code_verifier was included in the POST body
    const callArgs = mockFetch.mock.calls[0] as [string, { body: string }];
    expect(callArgs[1].body).toContain('code_verifier=my-code-verifier');

    vi.unstubAllGlobals();
  });
});
