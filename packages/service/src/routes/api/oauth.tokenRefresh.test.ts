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

    it.each([
      [
        'the provider refuses',
        () => Promise.resolve({ ok: false, status: 400 }),
      ],
      [
        'the provider is unreachable',
        () => Promise.reject(new TypeError('fetch failed')),
      ],
    ])('returns 401 when refresh fails (%s)', async (_label, answer) => {
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

      vi.stubGlobal('fetch', vi.fn(answer));

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

      vi.unstubAllGlobals();
    });
  });
});
