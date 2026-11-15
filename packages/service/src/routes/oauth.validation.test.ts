/**
 * Tests for OAuth2 callback route (GET /oauth/callback).
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearAllPending } from '../services/oauthState.js';
import { buildFastify, buildReply } from './oauth.testHelpers.js';

let tmpDir: string;
let mockConfig: Record<string, unknown> | null = null;

vi.mock('../config/index.js', () => ({
  getConfig: () => mockConfig,
}));

const { oauthRoute } = await import('./oauth.js');

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
});
