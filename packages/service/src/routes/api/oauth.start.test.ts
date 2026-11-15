/**
 * Tests for OAuth2 API routes: start, status, token.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearAllPending, consumePending } from '../../services/oauthState.js';
import { serverError } from '../../testing/testApp.js';
import { buildReply, buildRoutes } from './oauth.testHelpers.js';

let tmpDir: string;
let mockConfig: Record<string, unknown> | null = null;

vi.mock('../../config/index.js', () => ({
  getConfig: () => mockConfig,
}));

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
  function getHandlers() {
    return Promise.resolve(buildRoutes());
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
      expect(capture.body).toEqual(
        serverError(
          'SERVER_INVALID_REQUEST',
          'authUrl and tokenUrl are required (either in request body or via named provider config)',
        ),
      );
    });

    it('starts flow with named provider', async () => {
      mockConfig = { ...mockConfig, publicUrl: 'https://jeeves.example.com' };
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
          // Forged headers are ignored: publicUrl decides the origin.
          headers: {
            host: 'evil.example',
            'x-forwarded-host': 'evil.example',
            'x-forwarded-proto': 'http',
          },
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
      mockConfig = { ...mockConfig, publicUrl: 'http://localhost:1934' };
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
      mockConfig = { ...mockConfig, publicUrl: 'http://localhost:1934' };
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
});
