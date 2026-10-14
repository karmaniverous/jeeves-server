/**
 * Public origin: magic links, share-for links, the Google redirect URI and the
 * session cookie `secure` flag follow publicUrl, never forged headers.
 *
 * @packageDocumentation
 */

import cookie from '@fastify/cookie';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { RuntimeConfig } from '../../config/types.js';
import {
  INSIDER_EMAIL,
  INSIDER_SEED,
  makeRuntimeConfig,
} from '../../testing/authFixture.js';

const state = vi.hoisted((): { config: unknown } => ({ config: null }));
const sendMock = vi.hoisted(() => vi.fn(() => Promise.resolve()));

vi.mock('../../config/index.js', () => ({
  getConfig: () => state.config,
  resetConfig: vi.fn(),
}));
vi.mock('../../services/email.js', () => ({ sendMagicLinkEmail: sendMock }));
vi.mock('../../services/eventQueue.js', () => ({ appendEvent: vi.fn() }));
vi.mock('../../util/configPersist.js', () => ({
  writeInsiderSeedToConfig: vi.fn(),
}));

const { magicLinkApiRoute } = await import('./magicLink.js');
const { sharingRoutes } = await import('./sharing.js');
const { authRoute } = await import('../auth.js');
const { setSessionCookie } = await import('../../auth/session.js');

const FORGED = {
  host: 'evil.example',
  'x-forwarded-host': 'evil.example',
  'x-forwarded-proto': 'https',
};

/** Configure email + Google login, optionally with publicUrl. */
function useConfig(overrides: Partial<RuntimeConfig> = {}): void {
  state.config = makeRuntimeConfig({
    overrides: {
      authModes: ['keys', 'email', 'google'],
      emailAuth: { smtpUrl: 'smtp://localhost', fromAddress: 'a@b.example' },
      googleAuth: { clientId: 'client-id', clientSecret: 'client-secret' },
      sessionSecret: 's'.repeat(64),
      ...overrides,
    },
  });
}

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify();
  await app.register(cookie);
  app.addHook('preHandler', (request, _reply, done) => {
    request.authSeed = INSIDER_SEED;
    request.insiderScopes = null;
    done();
  });
  await app.register(magicLinkApiRoute);
  await app.register(sharingRoutes);
  await app.register(authRoute);
  app.get('/set-cookie', (request, reply) => {
    setSessionCookie(reply, request, INSIDER_EMAIL, 's'.repeat(64));
    return reply.send({ ok: true });
  });
  await app.ready();
  return app;
}

afterEach(() => {
  sendMock.mockClear();
});

describe('magic link origin', () => {
  it('builds the emailed link on publicUrl despite forged headers', async () => {
    useConfig({ publicUrl: 'https://docs.example.com' });
    const app = await buildApp();

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/magic',
      headers: FORGED,
      payload: { email: INSIDER_EMAIL },
    });
    await app.close();

    expect(res.statusCode).toBe(200);
    const link = (sendMock.mock.calls[0] as unknown[])[1] as string;
    expect(new URL(link).origin).toBe('https://docs.example.com');
    expect(new URL(link).pathname).toBe('/auth/magic/callback');
  });

  it.each([INSIDER_EMAIL, 'stranger@example.com'])(
    'refuses with a config error without publicUrl (%s)',
    async (email) => {
      useConfig();
      const app = await buildApp();

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/magic',
        headers: FORGED,
        payload: { email },
      });
      await app.close();

      expect(res.statusCode).toBe(500);
      expect(res.json<{ error: string }>().error).toMatch(/publicUrl/);
      expect(sendMock).not.toHaveBeenCalled();
    },
  );

  it('uses trusted forwarding headers only with trustProxyHeaders', async () => {
    useConfig({ trustProxyHeaders: true });
    const app = await buildApp();

    await app.inject({
      method: 'POST',
      url: '/api/auth/magic',
      headers: { host: 'internal:1934', 'x-forwarded-host': 'proxy.example' },
      payload: { email: INSIDER_EMAIL },
    });
    await app.close();

    const link = (sendMock.mock.calls[0] as unknown[])[1] as string;
    expect(new URL(link).host).toBe('proxy.example');
  });
});

describe('share-for origin', () => {
  const shareFor = async (app: FastifyInstance, insiders: string[]) =>
    (
      await app.inject({
        method: 'POST',
        url: '/api/util/share-for',
        headers: FORGED,
        payload: { path: '/r/a.md', insiders },
      })
    ).json<{ url: string }>().url;

  it.each([
    ['insider', [INSIDER_EMAIL]],
    ['outsider', ['stranger@example.com']],
  ])('%s link follows publicUrl', async (_label, insiders) => {
    useConfig({ publicUrl: 'https://docs.example.com' });
    const app = await buildApp();
    const url = await shareFor(app, insiders);
    await app.close();
    expect(url.startsWith('https://docs.example.com/browse/r/a.md')).toBe(true);
  });

  it.each([
    ['insider', [INSIDER_EMAIL]],
    ['outsider', ['stranger@example.com']],
  ])('%s link is relative without publicUrl', async (_label, insiders) => {
    useConfig();
    const app = await buildApp();
    const url = await shareFor(app, insiders);
    await app.close();
    expect(url.startsWith('/browse/r/a.md')).toBe(true);
  });
});

describe('Google redirect URI', () => {
  it('uses publicUrl despite forged headers', async () => {
    useConfig({ publicUrl: 'https://docs.example.com' });
    const app = await buildApp();
    const res = await app.inject({ url: '/auth/login', headers: FORGED });
    await app.close();

    expect(res.statusCode).toBe(302);
    const location = new URL(String(res.headers.location));
    expect(location.searchParams.get('redirect_uri')).toBe(
      'https://docs.example.com/auth/callback',
    );
  });

  it('refuses with a config error without publicUrl', async () => {
    useConfig();
    const app = await buildApp();
    const res = await app.inject({ url: '/auth/login', headers: FORGED });
    await app.close();

    expect(res.statusCode).toBe(500);
    expect(res.json<{ error: string }>().error).toMatch(/publicUrl/);
  });
});

describe('session cookie secure flag', () => {
  const setCookie = async () => {
    const app = await buildApp();
    const res = await app.inject({ url: '/set-cookie', headers: FORGED });
    await app.close();
    return String(res.headers['set-cookie']);
  };

  it('is secure for an https publicUrl', async () => {
    useConfig({ publicUrl: 'https://docs.example.com' });
    expect(await setCookie()).toMatch(/;\s*Secure/i);
  });

  it('is not secure without publicUrl, whatever X-Forwarded-Proto says', async () => {
    useConfig();
    expect(await setCookie()).not.toMatch(/;\s*Secure/i);
  });

  it('is not secure for an http publicUrl', async () => {
    useConfig({ publicUrl: 'http://localhost:1934' });
    expect(await setCookie()).not.toMatch(/;\s*Secure/i);
  });
});
