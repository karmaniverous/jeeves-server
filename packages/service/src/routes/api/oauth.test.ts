/**
 * Tests for OAuth2 API routes: start, status, token.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearAllPending, consumePending } from '../../services/oauthState.js';

let tmpDir: string;
let mockConfig: Record<string, unknown> | null = null;

vi.mock('../../config/index.js', () => ({
  getConfig: () => mockConfig,
}));

const { oauthApiRoutes } = await import('./oauth.js');

type Handler = (req: unknown, reply: unknown) => Promise<unknown>;

function buildFastify(): {
  routes: Record<string, { method: string; handler: Handler }>;
  instance: unknown;
} {
  const routes: Record<string, { method: string; handler: Handler }> = {};
  const instance = {
    post: (routePath: string, handler: Handler) => {
      routes[routePath] = { method: 'POST', handler };
    },
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

describe('OAuth API routes', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jeeves-oauth-api-'));
    mockConfig = {
      oauth: {
        credentialDir: tmpDir,
        providers: {
          github: {
            authUrl: 'https://github.com/login/oauth/authorize',
            tokenUrl: 'https://github.com/login/oauth/access_token',
            pkce: false,
            defaultScopes: ['repo'],
          },
        },
      },
    };
  });

  afterEach(() => {
    clearAllPending();
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  // Helper to get route handlers
  async function getHandlers() {
    const { routes, instance } = buildFastify();
    await oauthApiRoutes(instance as never, {});
    return routes;
  }

  // ─── POST /oauth/start ───

  describe('POST /oauth/start', () => {
    it('returns 501 when oauth config absent', async () => {
      mockConfig = { oauth: null };
      const routes = await getHandlers();
      const { reply, capture } = buildReply();
      await routes['/api/oauth/start'].handler(
        { body: {}, accessMode: 'insider', headers: {} },
        reply,
      );
      expect(capture.statusCode).toBe(501);
    });

    it('returns 401 for non-insider', async () => {
      const routes = await getHandlers();
      const { reply, capture } = buildReply();
      await routes['/api/oauth/start'].handler(
        {
          body: {
            provider: 'x',
            account: 'a',
            clientId: 'c',
            clientSecret: 's',
          },
          accessMode: 'outsider',
          headers: {},
        },
        reply,
      );
      expect(capture.statusCode).toBe(401);
    });

    it('returns 400 for missing required fields', async () => {
      const routes = await getHandlers();
      const { reply, capture } = buildReply();
      await routes['/api/oauth/start'].handler(
        { body: { provider: 'test' }, accessMode: 'insider', headers: {} },
        reply,
      );
      expect(capture.statusCode).toBe(400);
    });

    it('returns 400 when authUrl/tokenUrl not resolvable', async () => {
      const routes = await getHandlers();
      const { reply, capture } = buildReply();
      await routes['/api/oauth/start'].handler(
        {
          body: {
            provider: 'unknown',
            account: 'a',
            clientId: 'c',
            clientSecret: 's',
          },
          accessMode: 'insider',
          headers: { host: 'localhost:1934' },
        },
        reply,
      );
      expect(capture.statusCode).toBe(400);
      expect((capture.body as Record<string, string>).error).toMatch(
        /authUrl and tokenUrl/,
      );
    });

    it('starts flow with named provider', async () => {
      const routes = await getHandlers();
      const { reply, capture } = buildReply();
      await routes['/api/oauth/start'].handler(
        {
          body: {
            provider: 'github',
            account: 'myuser',
            clientId: 'cid',
            clientSecret: 'csecret',
          },
          accessMode: 'insider',
          headers: { host: 'jeeves.example.com', 'x-forwarded-proto': 'https' },
        },
        reply,
      );
      expect(capture.statusCode).toBe(200);
      const body = capture.body as { authUrl: string; state: string };
      expect(body.state).toBeTruthy();
      expect(body.authUrl).toContain('github.com/login/oauth/authorize');
      expect(body.authUrl).toContain('response_type=code');
      expect(body.authUrl).toContain('client_id=cid');
      expect(body.authUrl).toContain('scope=repo');

      // Verify pending state was stored
      const pending = consumePending(body.state);
      expect(pending).not.toBeNull();
      expect(pending?.provider).toBe('github');
      expect(pending?.account).toBe('myuser');
      expect(pending?.redirectUri).toBe(
        'https://jeeves.example.com/oauth/callback',
      );
    });

    it('starts flow with ad-hoc provider', async () => {
      const routes = await getHandlers();
      const { reply, capture } = buildReply();
      await routes['/api/oauth/start'].handler(
        {
          body: {
            provider: 'custom',
            account: 'me',
            clientId: 'cid',
            clientSecret: 'csecret',
            authUrl: 'https://custom.auth/authorize',
            tokenUrl: 'https://custom.auth/token',
            scopes: ['read', 'write'],
          },
          accessMode: 'insider',
          headers: { host: 'localhost:1934' },
        },
        reply,
      );
      expect(capture.statusCode).toBe(200);
      const body = capture.body as { authUrl: string; state: string };
      expect(body.authUrl).toContain('custom.auth');
      expect(body.authUrl).toContain('scope=read+write');
    });

    it('includes PKCE params when pkce is true', async () => {
      const routes = await getHandlers();
      const { reply, capture } = buildReply();
      await routes['/api/oauth/start'].handler(
        {
          body: {
            provider: 'custom',
            account: 'me',
            clientId: 'cid',
            clientSecret: 'csecret',
            authUrl: 'https://auth.example.com/authorize',
            tokenUrl: 'https://auth.example.com/token',
            pkce: true,
          },
          accessMode: 'insider',
          headers: { host: 'localhost:1934' },
        },
        reply,
      );
      expect(capture.statusCode).toBe(200);
      const body = capture.body as { authUrl: string; state: string };
      expect(body.authUrl).toContain('code_challenge=');
      expect(body.authUrl).toContain('code_challenge_method=S256');

      // Verify code_verifier is stored
      const pending = consumePending(body.state);
      expect(pending?.codeVerifier).toBeTruthy();
    });

    it('uses explicit origin for redirect_uri', async () => {
      const routes = await getHandlers();
      const { reply, capture } = buildReply();
      await routes['/api/oauth/start'].handler(
        {
          body: {
            provider: 'github',
            account: 'me',
            clientId: 'cid',
            clientSecret: 'csecret',
            origin: 'https://public.example.com',
          },
          accessMode: 'insider',
          headers: { host: 'internal:1934' },
        },
        reply,
      );
      const body = capture.body as { authUrl: string; state: string };
      expect(body.authUrl).toContain(
        encodeURIComponent('https://public.example.com/oauth/callback'),
      );
    });
  });

  // ─── GET /oauth/status ───

  describe('GET /oauth/status', () => {
    it('returns 501 when oauth config absent', async () => {
      mockConfig = { oauth: null };
      const routes = await getHandlers();
      const { reply, capture } = buildReply();
      await routes['/api/oauth/status'].handler(
        { query: { provider: 'x', account: 'y' }, accessMode: 'insider' },
        reply,
      );
      expect(capture.statusCode).toBe(501);
    });

    it('returns exists: false for missing credential', async () => {
      const routes = await getHandlers();
      const { reply, capture } = buildReply();
      await routes['/api/oauth/status'].handler(
        {
          query: { provider: 'github', account: 'nobody' },
          accessMode: 'insider',
        },
        reply,
      );
      const body = capture.body as Record<string, unknown>;
      expect(body.exists).toBe(false);
      expect(body.expired).toBe(false);
    });

    it('returns exists: true, expired: false for valid credential', async () => {
      const credPath = path.join(tmpDir, 'github-me-oauth2.json');
      fs.writeFileSync(
        credPath,
        JSON.stringify({
          access_token: 'tok',
          token_type: 'Bearer',
          obtained_at: new Date().toISOString(),
          expires_in: 3600,
        }),
      );

      const routes = await getHandlers();
      const { reply, capture } = buildReply();
      await routes['/api/oauth/status'].handler(
        { query: { provider: 'github', account: 'me' }, accessMode: 'insider' },
        reply,
      );
      const body = capture.body as Record<string, unknown>;
      expect(body.exists).toBe(true);
      expect(body.expired).toBe(false);
    });

    it('returns expired: true for expired credential', async () => {
      const credPath = path.join(tmpDir, 'github-me-oauth2.json');
      fs.writeFileSync(
        credPath,
        JSON.stringify({
          access_token: 'tok',
          token_type: 'Bearer',
          obtained_at: new Date(Date.now() - 7200 * 1000).toISOString(),
          expires_in: 3600,
        }),
      );

      const routes = await getHandlers();
      const { reply, capture } = buildReply();
      await routes['/api/oauth/status'].handler(
        { query: { provider: 'github', account: 'me' }, accessMode: 'insider' },
        reply,
      );
      const body = capture.body as Record<string, unknown>;
      expect(body.exists).toBe(true);
      expect(body.expired).toBe(true);
    });

    it('returns expired: false when expires_in is absent', async () => {
      const credPath = path.join(tmpDir, 'github-me-oauth2.json');
      fs.writeFileSync(
        credPath,
        JSON.stringify({
          access_token: 'tok',
          token_type: 'Bearer',
          obtained_at: new Date(Date.now() - 999999 * 1000).toISOString(),
        }),
      );

      const routes = await getHandlers();
      const { reply, capture } = buildReply();
      await routes['/api/oauth/status'].handler(
        { query: { provider: 'github', account: 'me' }, accessMode: 'insider' },
        reply,
      );
      const body = capture.body as Record<string, unknown>;
      expect(body.exists).toBe(true);
      expect(body.expired).toBe(false);
    });
  });

  // ─── GET /oauth/token ───

  describe('GET /oauth/token', () => {
    it('returns 501 when oauth config absent', async () => {
      mockConfig = { oauth: null };
      const routes = await getHandlers();
      const { reply, capture } = buildReply();
      await routes['/api/oauth/token'].handler(
        { query: { provider: 'x', account: 'y' }, accessMode: 'insider' },
        reply,
      );
      expect(capture.statusCode).toBe(501);
    });

    it('returns 404 for missing credential file', async () => {
      const routes = await getHandlers();
      const { reply, capture } = buildReply();
      await routes['/api/oauth/token'].handler(
        {
          query: { provider: 'github', account: 'nobody' },
          accessMode: 'insider',
        },
        reply,
      );
      expect(capture.statusCode).toBe(404);
    });

    it('returns valid token when not expired', async () => {
      const credPath = path.join(tmpDir, 'github-me-oauth2.json');
      fs.writeFileSync(
        credPath,
        JSON.stringify({
          access_token: 'my-access-token',
          token_type: 'Bearer',
          obtained_at: new Date().toISOString(),
          expires_in: 3600,
          tokenUrl: 'https://github.com/login/oauth/access_token',
          clientId: 'cid',
          clientSecret: 'csecret',
        }),
      );

      const routes = await getHandlers();
      const { reply, capture } = buildReply();
      await routes['/api/oauth/token'].handler(
        { query: { provider: 'github', account: 'me' }, accessMode: 'insider' },
        reply,
      );
      expect(capture.statusCode).toBe(200);
      const body = capture.body as Record<string, unknown>;
      expect(body.access_token).toBe('my-access-token');
      expect(body.token_type).toBe('Bearer');
      expect(typeof body.expires_in_seconds).toBe('number');
    });

    it('returns token with null expires_in_seconds when no expiry', async () => {
      const credPath = path.join(tmpDir, 'github-me-oauth2.json');
      fs.writeFileSync(
        credPath,
        JSON.stringify({
          access_token: 'forever-token',
          token_type: 'Bearer',
          obtained_at: new Date().toISOString(),
          tokenUrl: 'https://example.com/token',
          clientId: 'cid',
          clientSecret: 'csecret',
        }),
      );

      const routes = await getHandlers();
      const { reply, capture } = buildReply();
      await routes['/api/oauth/token'].handler(
        { query: { provider: 'github', account: 'me' }, accessMode: 'insider' },
        reply,
      );
      const body = capture.body as Record<string, unknown>;
      expect(body.access_token).toBe('forever-token');
      expect(body.expires_in_seconds).toBeNull();
    });

    it('returns 401 when expired with no refresh_token', async () => {
      const credPath = path.join(tmpDir, 'github-me-oauth2.json');
      fs.writeFileSync(
        credPath,
        JSON.stringify({
          access_token: 'old-token',
          token_type: 'Bearer',
          obtained_at: new Date(Date.now() - 7200 * 1000).toISOString(),
          expires_in: 3600,
          tokenUrl: 'https://example.com/token',
          clientId: 'cid',
          clientSecret: 'csecret',
        }),
      );

      const routes = await getHandlers();
      const { reply, capture } = buildReply();
      await routes['/api/oauth/token'].handler(
        { query: { provider: 'github', account: 'me' }, accessMode: 'insider' },
        reply,
      );
      expect(capture.statusCode).toBe(401);
      expect((capture.body as Record<string, string>).error).toBe(
        'refresh_failed',
      );
    });

    it('refreshes token when expired with refresh_token', async () => {
      const credPath = path.join(tmpDir, 'github-me-oauth2.json');
      fs.writeFileSync(
        credPath,
        JSON.stringify({
          access_token: 'old-token',
          refresh_token: 'my-refresh',
          token_type: 'Bearer',
          obtained_at: new Date(Date.now() - 7200 * 1000).toISOString(),
          expires_in: 3600,
          tokenUrl: 'https://token.example.com/token',
          clientId: 'cid',
          clientSecret: 'csecret',
        }),
      );

      // Mock fetch for refresh
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: 'new-access-token',
            token_type: 'Bearer',
            expires_in: 7200,
          }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const routes = await getHandlers();
      const { reply, capture } = buildReply();
      await routes['/api/oauth/token'].handler(
        { query: { provider: 'github', account: 'me' }, accessMode: 'insider' },
        reply,
      );
      expect(capture.statusCode).toBe(200);
      const body = capture.body as Record<string, unknown>;
      expect(body.access_token).toBe('new-access-token');

      // Verify fetch was called with correct params
      expect(mockFetch).toHaveBeenCalledWith(
        'https://token.example.com/token',
        expect.objectContaining({ method: 'POST' }),
      );

      // Verify credential file was updated
      const updated = JSON.parse(fs.readFileSync(credPath, 'utf8')) as Record<
        string,
        unknown
      >;
      expect(updated.access_token).toBe('new-access-token');
      expect(updated.expires_in).toBe(7200);

      vi.unstubAllGlobals();
    });

    it('preserves old refresh_token when refresh response lacks one', async () => {
      const credPath = path.join(tmpDir, 'github-me-oauth2.json');
      fs.writeFileSync(
        credPath,
        JSON.stringify({
          access_token: 'old-token',
          refresh_token: 'original-refresh',
          token_type: 'Bearer',
          obtained_at: new Date(Date.now() - 7200 * 1000).toISOString(),
          expires_in: 3600,
          tokenUrl: 'https://token.example.com/token',
          clientId: 'cid',
          clientSecret: 'csecret',
        }),
      );

      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              access_token: 'new-access-token',
              token_type: 'Bearer',
              expires_in: 7200,
              // no refresh_token in response
            }),
        }),
      );

      const routes = await getHandlers();
      const { reply, capture } = buildReply();
      await routes['/api/oauth/token'].handler(
        { query: { provider: 'github', account: 'me' }, accessMode: 'insider' },
        reply,
      );
      expect(capture.statusCode).toBe(200);

      const updated = JSON.parse(fs.readFileSync(credPath, 'utf8')) as Record<
        string,
        unknown
      >;
      expect(updated.access_token).toBe('new-access-token');
      expect(updated.refresh_token).toBe('original-refresh');

      vi.unstubAllGlobals();
    });

    it('preserves old scope when refresh response lacks scope', async () => {
      const credPath = path.join(tmpDir, 'github-me-oauth2.json');
      fs.writeFileSync(
        credPath,
        JSON.stringify({
          access_token: 'old-token',
          refresh_token: 'my-refresh',
          token_type: 'Bearer',
          scope: 'repo user',
          obtained_at: new Date(Date.now() - 7200 * 1000).toISOString(),
          expires_in: 3600,
          tokenUrl: 'https://token.example.com/token',
          clientId: 'cid',
          clientSecret: 'csecret',
        }),
      );

      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              access_token: 'new-access-token',
              token_type: 'Bearer',
              expires_in: 7200,
              // no scope in response
            }),
        }),
      );

      const routes = await getHandlers();
      const { reply, capture } = buildReply();
      await routes['/api/oauth/token'].handler(
        { query: { provider: 'github', account: 'me' }, accessMode: 'insider' },
        reply,
      );
      expect(capture.statusCode).toBe(200);

      const updated = JSON.parse(fs.readFileSync(credPath, 'utf8')) as Record<
        string,
        unknown
      >;
      expect(updated.scope).toBe('repo user');

      vi.unstubAllGlobals();
    });

    it('returns 401 when refresh fails', async () => {
      const credPath = path.join(tmpDir, 'github-me-oauth2.json');
      fs.writeFileSync(
        credPath,
        JSON.stringify({
          access_token: 'old-token',
          refresh_token: 'bad-refresh',
          token_type: 'Bearer',
          obtained_at: new Date(Date.now() - 7200 * 1000).toISOString(),
          expires_in: 3600,
          tokenUrl: 'https://token.example.com/token',
          clientId: 'cid',
          clientSecret: 'csecret',
        }),
      );

      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: false, status: 400 }),
      );

      const routes = await getHandlers();
      const { reply, capture } = buildReply();
      await routes['/api/oauth/token'].handler(
        { query: { provider: 'github', account: 'me' }, accessMode: 'insider' },
        reply,
      );
      expect(capture.statusCode).toBe(401);
      expect((capture.body as Record<string, string>).error).toBe(
        'refresh_failed',
      );

      vi.unstubAllGlobals();
    });
  });
});
