/**
 * Tests for OAuth2 API routes: start, status, token.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearAllPending } from '../../services/oauthState.js';
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
});
