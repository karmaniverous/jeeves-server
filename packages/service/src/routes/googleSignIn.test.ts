/**
 * Google sign-in (#304, #270): an insider gets a session; anyone else gets the rejection page, or 403 `SERVER_SIGN_IN_REJECTED` as a JSON client, and a `warn` log line; "different account" restarts sign-in with `prompt=select_account`.
 *
 * @packageDocumentation
 */

import { Writable } from 'node:stream';

import cookie from '@fastify/cookie';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { RuntimeConfig } from '../config/types.js';
import { INSIDER_EMAIL, makeRuntimeConfig } from '../testing/authFixture.js';
import { serverError, testApp } from '../testing/testApp.js';

const state = vi.hoisted((): { config: unknown } => ({ config: null }));

vi.mock('../config/index.js', () => ({
  getConfig: () => state.config,
  resetConfig: vi.fn(),
}));
vi.mock('../util/configPersist.js', () => ({
  writeInsiderSeedToConfig: vi.fn(),
}));

const { googleSignInRoute } = await import('./googleSignIn.js');

/** `state` for a returnTo, as `/auth/login` encodes it. */
const encodeState = (returnTo: string): string =>
  Buffer.from(returnTo).toString('base64url');

let logLines: Record<string, unknown>[];
let app: FastifyInstance;

/** Answer Google's token and userinfo endpoints with this account. */
function googleReturns(email: string, verified = true): void {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) =>
      Promise.resolve(
        new Response(
          JSON.stringify(
            url.includes('token')
              ? { access_token: 'at', expires_in: 1, token_type: 'Bearer' }
              : { sub: '1', email, email_verified: verified },
          ),
          { status: 200 },
        ),
      ),
    ),
  );
}

async function buildApp(overrides: Partial<RuntimeConfig> = {}): Promise<void> {
  state.config = makeRuntimeConfig({
    overrides: {
      authModes: ['google', 'keys'],
      googleAuth: { clientId: 'client-id', clientSecret: 'client-secret' },
      sessionSecret: 's'.repeat(64),
      publicUrl: 'https://docs.example.com',
      branding: { name: 'Acme Docs', emoji: 'A' },
      ...overrides,
    },
  });
  logLines = [];
  const stream = new Writable({
    write(chunk: Buffer, _enc, cb) {
      logLines.push(JSON.parse(chunk.toString()) as Record<string, unknown>);
      cb();
    },
  });
  app = testApp({ logger: { level: 'warn', stream } });
  await app.register(cookie);
  await app.register(googleSignInRoute);
  await app.ready();
}

const callback = (accept?: string, returnTo = '/browse/j/a.md') =>
  app.inject({
    method: 'GET',
    url: `/auth/callback?code=c&state=${encodeState(returnTo)}`,
    headers: accept ? { accept } : {},
  });

const rejections = () =>
  logLines.filter((l) => l.msg === 'Google sign-in rejected');

beforeEach(() => {
  logLines = [];
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await app.close();
});

describe('GET /auth/callback', () => {
  it('signs an insider in and redirects to returnTo', async () => {
    await buildApp();
    googleReturns(INSIDER_EMAIL.toUpperCase());
    const res = await callback();
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('/browse/j/a.md');
    expect(res.headers['set-cookie']).toBeDefined();
    expect(rejections()).toEqual([]);
  });

  it('shows a non-insider the rejection page', async () => {
    await buildApp({
      authModes: ['google', 'email'],
      accessContact: 'ops@example.com',
    });
    googleReturns('Stranger@Example.com');
    const res = await callback(
      'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    );
    expect(res.statusCode).toBe(403);
    expect(res.headers['content-type']).toBe('text/html; charset=utf-8');
    expect(res.headers['set-cookie']).toBeUndefined();
    expect(res.body).toContain('<strong>stranger@example.com</strong>');
    expect(res.body).toContain("isn't on the access list for Acme Docs");
    expect(res.body).toContain(
      'href="/auth/login?returnTo=%2Fbrowse%2Fj%2Fa.md&amp;prompt=select_account"',
    );
    expect(res.body).toContain('href="/browse/j/a.md#magicForm"');
    expect(res.body).toContain('href="mailto:ops@example.com"');
    expect(rejections()).toEqual([
      expect.objectContaining({
        level: 40,
        email: 'stranger@example.com',
        reason: 'not_insider',
      }),
    ]);
  });

  it('shows an unverified account the rejection page, even an insider', async () => {
    await buildApp();
    googleReturns(INSIDER_EMAIL, false);
    const res = await callback();
    expect(res.statusCode).toBe(403);
    expect(res.body).toContain("email address isn't verified");
    expect(res.headers['set-cookie']).toBeUndefined();
    expect(rejections()).toEqual([
      expect.objectContaining({ email: INSIDER_EMAIL, reason: 'unverified' }),
    ]);
  });

  it('validates returnTo before echoing it', async () => {
    await buildApp();
    googleReturns('stranger@example.com');
    const res = await callback(undefined, '//evil.example/x');
    expect(res.body).toContain('returnTo=%2Fbrowse&amp;prompt=select_account');
    expect(res.body).not.toContain('evil.example');
  });

  it.each([
    [
      'not_insider',
      'stranger@example.com',
      true,
      "This Google account is not on this server's access list",
    ],
    [
      'unverified',
      INSIDER_EMAIL,
      false,
      "This Google account's email address is not verified",
    ],
  ])(
    'answers a JSON client with SERVER_SIGN_IN_REJECTED (%s)',
    async (reason, email, verified, message) => {
      await buildApp();
      googleReturns(email, verified);
      const res = await callback('application/json');
      expect(res.statusCode).toBe(403);
      expect(res.json()).toEqual(
        serverError('SERVER_SIGN_IN_REJECTED', message),
      );
      expect(rejections()).toEqual([
        expect.objectContaining({ email, reason }),
      ]);
    },
  );
});

describe('GET /auth/callback failures', () => {
  it.each([
    ['the token exchange', 'token'],
    ['the account lookup', 'userinfo'],
  ])('is a masked 500 when %s fails', async (_label, failing) => {
    await buildApp();
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        Promise.resolve(
          url.includes(failing)
            ? new Response('nope', { status: 400 })
            : new Response(
                JSON.stringify({ access_token: 'at', expires_in: 1 }),
                { status: 200 },
              ),
        ),
      ),
    );
    const res = await callback();
    expect(res.statusCode).toBe(500);
    expect(res.headers['set-cookie']).toBeUndefined();
    expect(rejections()).toEqual([]);
  });

  it('answers a missing code with 400', async () => {
    await buildApp();
    const res = await app.inject({ method: 'GET', url: '/auth/callback' });
    expect(res.statusCode).toBe(400);
  });

  it("answers Google's error with 403", async () => {
    await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/auth/callback?error=access_denied',
    });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: 'OAuth error: access_denied' });
  });

  it('answers 500 without Google sign-in configured', async () => {
    await buildApp({ googleAuth: null });
    const res = await callback();
    expect(res.statusCode).toBe(500);
  });
});

describe('GET /auth/logout', () => {
  it('clears the session cookie and goes home', async () => {
    await buildApp();
    const res = await app.inject({ method: 'GET', url: '/auth/logout' });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('/');
    expect(String(res.headers['set-cookie'])).toMatch(
      /Expires=Thu, 01 Jan 1970/u,
    );
  });
});

describe('GET /auth/login', () => {
  it.each([
    [undefined, 'consent'],
    ['select_account', 'select_account'],
    ['none', 'consent'],
  ])('prompt %s sends Google prompt=%s', async (prompt, expected) => {
    await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: `/auth/login?returnTo=%2Fbrowse${prompt ? `&prompt=${prompt}` : ''}`,
    });
    expect(res.statusCode).toBe(302);
    const url = new URL(res.headers.location ?? '');
    expect(url.searchParams.get('prompt')).toBe(expected);
    expect(url.searchParams.get('redirect_uri')).toBe(
      'https://docs.example.com/auth/callback',
    );
    expect(url.searchParams.get('state')).toBe(encodeState('/browse'));
  });
});
