/**
 * Tests for OAuth2 API routes: start, status, token.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearAllPending } from '../../services/oauthState.js';
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
      expect(capture.body).toEqual(
        serverError('SERVER_OAUTH_REFRESH_FAILED', 'Re-authorization required'),
      );
    });
  });
});
