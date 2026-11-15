/**
 * Tests for OAuth2 API routes: start, status, token.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearAllPending, consumePending } from '../../services/oauthState.js';
import { MASKED_500, serverError } from '../../testing/testApp.js';
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
    const startBody = {
      provider: 'github',
      account: 'me',
      clientId: 'cid',
      clientSecret: 'csecret',
    };

    it.each([
      ['not a url', 'origin must be a valid URL'],
      // The URL parser reads `\` as `/`; refused before parsing (#300).
      ['https://public.example.com\\', 'origin must be a valid URL'],
      ['https://public.example.com\\evil', 'origin must be a valid URL'],
      ['https:\\\\public.example.com', 'origin must be a valid URL'],
      [
        'http://public.example.com',
        'origin scheme must be https (or http for localhost)',
      ],
      ['https://public.example.com/app', 'origin must not have a pathname'],
      [
        'https://public.example.com/?a=1',
        'origin must not have query parameters',
      ],
      ['https://public.example.com/?', 'origin must not have query parameters'],
      [
        'https://user:***@public.example.com',
        'origin must not contain credentials',
      ],
      [
        'https://user@public.example.com',
        'origin must not contain credentials',
      ],
      ['https://@public.example.com', 'origin must not contain credentials'],
      ['https://public.example.com/#x', 'origin must not have a fragment'],
      ['https://public.example.com#x', 'origin must not have a fragment'],
      ['https://public.example.com/#', 'origin must not have a fragment'],
    ])('rejects origin %s', async (origin, error) => {
      const routes = await getHandlers();
      const { reply, capture } = buildReply();
      await routes['/api/oauth/start'].handler(
        { body: { ...startBody, origin }, accessMode: 'insider', headers: {} },
        reply,
      );
      expect(capture.statusCode).toBe(400);
      expect(capture.body).toEqual(
        serverError('SERVER_INVALID_REQUEST', error),
      );
    });

    it.each([
      ['http://localhost:5173', 'http://localhost:5173/oauth/callback'],
      [
        'https://public.example.com/',
        'https://public.example.com/oauth/callback',
      ],
    ])('accepts origin %s', async (origin, redirectUri) => {
      const routes = await getHandlers();
      const { reply, capture } = buildReply();
      await routes['/api/oauth/start'].handler(
        { body: { ...startBody, origin }, accessMode: 'insider', headers: {} },
        reply,
      );
      expect(capture.statusCode).toBe(200);
      const pending = consumePending((capture.body as { state: string }).state);
      expect(pending?.redirectUri).toBe(redirectUri);
    });

    it('refuses without publicUrl or trustProxyHeaders (no header origin)', async () => {
      const routes = await getHandlers();
      const { reply, capture } = buildReply();
      await routes['/api/oauth/start'].handler(
        {
          body: startBody,
          accessMode: 'insider',
          headers: { host: 'evil.example', 'x-forwarded-proto': 'https' },
        },
        reply,
      );
      // A config error: masked for the caller, logged for the operator.
      expect(capture.statusCode).toBe(500);
      expect(capture.body).toEqual(MASKED_500);
    });

    it('uses forwarding headers only with trustProxyHeaders', async () => {
      mockConfig = { ...mockConfig, trustProxyHeaders: true };
      const routes = await getHandlers();
      const { reply, capture } = buildReply();
      await routes['/api/oauth/start'].handler(
        {
          body: startBody,
          accessMode: 'insider',
          headers: {
            host: 'internal:1934',
            'x-forwarded-host': 'proxy.example.com',
            'x-forwarded-proto': 'https',
          },
        },
        reply,
      );
      const pending = consumePending((capture.body as { state: string }).state);
      expect(pending?.redirectUri).toBe(
        'https://proxy.example.com/oauth/callback',
      );
    });
  });
});
