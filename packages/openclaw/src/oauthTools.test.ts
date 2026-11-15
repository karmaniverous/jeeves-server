/**
 * OAuth tools on the SDK: `oauth_authorize` (start body, public URL as origin, 0.15.0 result text, admin guidance on a 400), `oauth_status` and `oauth_token` (provider and account sent with the key).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  fakeServer,
  jsonOf,
  PLUGIN_KEY,
  pluginTools,
  runTool,
  textOf,
} from './test/fakeServer.js';

const AUTHORIZE = {
  provider: 'google',
  account: 'a',
  clientId: 'id',
  clientSecret: 'secret',
};

beforeEach(() => {
  vi.stubEnv('JEEVES_CONFIG_ROOT', '');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('oauth_authorize', () => {
  it('starts the flow and returns the URL to open', async () => {
    const requests = fakeServer({
      'POST /api/oauth/start': {
        body: { authUrl: 'https://accounts.test/auth', state: 's' },
      },
    });
    const result = await runTool(pluginTools(), 'oauth_authorize', {
      ...AUTHORIZE,
      scopes: ['email'],
    });
    expect(requests[0]?.body).toEqual({ ...AUTHORIZE, scopes: ['email'] });
    expect(requests[0]?.url.searchParams.get('k')).toBe(PLUGIN_KEY);
    expect(jsonOf(result)).toBe(
      'Please open this URL to authorize google for account a:\n\nhttps://accounts.test/auth\n\nOnce you complete authorization in the browser, the credentials will be saved automatically.',
    );
  });

  it('adds the admin guidance to a 400', async () => {
    fakeServer({
      'POST /api/oauth/start': {
        status: 400,
        body: {
          statusCode: 400,
          code: 'SERVER_BAD_REQUEST',
          error: 'Bad Request',
          message: 'Unknown provider',
        },
      },
    });
    const result = await runTool(pluginTools(), 'oauth_authorize', AUTHORIZE);
    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/^Error: HTTP 400: Unknown provider/);
    expect(textOf(result)).toContain('`oauth.providers`');
  });

  it('adds no guidance to other errors', async () => {
    fakeServer({});
    const result = await runTool(pluginTools(), 'oauth_authorize', AUTHORIZE);
    expect(textOf(result)).toMatch(/^Error: HTTP 404/);
    expect(textOf(result)).not.toContain('oauth.providers');
  });
});

describe('oauth_status and oauth_token', () => {
  it.each([
    [
      'oauth_status',
      '/api/oauth/status',
      { exists: true, expired: false, provider: 'google', account: 'a' },
    ],
    [
      'oauth_token',
      '/api/oauth/token',
      { access_token: 't', token_type: 'Bearer', expires_in_seconds: 1 },
    ],
  ])('%s sends provider, account and the key', async (tool, path, body) => {
    const requests = fakeServer({ [`GET ${path}`]: { body } });
    const result = await runTool(pluginTools(), tool, {
      provider: 'google',
      account: 'a',
    });
    expect(textOf(result)).not.toMatch(/^Error/);
    const query = requests[0]?.url.searchParams ?? new URLSearchParams();
    expect(query.get('provider')).toBe('google');
    expect(query.get('account')).toBe('a');
    expect(query.get('k')).toBe(PLUGIN_KEY);
  });
});
