/**
 * OAuth provider and account names are validated before they become part
 * of a credential file path.
 *
 * @packageDocumentation
 */

import path from 'node:path';

import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { makeRuntimeConfig } from '../../testing/authFixture.js';

const CRED_DIR = path.resolve('/srv/jeeves/credentials');

vi.mock('../../config/index.js', () => ({
  getConfig: () =>
    makeRuntimeConfig({
      overrides: {
        publicUrl: 'https://docs.example.com',
        oauth: { credentialDir: CRED_DIR, providers: {} },
      },
    }),
}));

const { oauthApiRoutes } = await import('./oauth.js');
const { credentialPath, isValidCredentialName } =
  await import('../../services/oauthState.js');

let app: FastifyInstance;

beforeAll(async () => {
  app = Fastify();
  app.addHook('preHandler', (request, _reply, done) => {
    request.accessMode = 'insider';
    done();
  });
  await app.register(oauthApiRoutes);
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

const BAD_NAMES = [
  '..',
  '.',
  '../etc',
  '../jason@johngalt.id',
  'a/b',
  'a\\b',
  'x@y.io/..',
  '/abs',
  'C:\\abs',
  'with space',
  '\u0000',
  'a\u0000b',
  'a\nb',
  'a\tb',
  'a\u007fb',
];

const GOOD_NAMES = [
  'google',
  'x',
  'salesforce-prod',
  'my.account_1',
  'jason@johngalt.id',
  'a+b@x.io',
  // `..` inside a name is not a path segment once separators are excluded.
  'a..b',
];

describe('isValidCredentialName', () => {
  it.each(GOOD_NAMES)('accepts %s', (name) => {
    expect(isValidCredentialName(name)).toBe(true);
  });

  it.each([...BAD_NAMES, ''])('rejects %j', (name) => {
    expect(isValidCredentialName(name)).toBe(false);
  });
});

describe('credentialPath', () => {
  it('builds a path inside the credential directory', () => {
    expect(credentialPath(CRED_DIR, 'google', 'me')).toBe(
      path.join(CRED_DIR, 'google-me-oauth2.json'),
    );
  });

  it.each(GOOD_NAMES)('keeps %s inside the credential directory', (name) => {
    for (const file of [
      credentialPath(CRED_DIR, name, 'me'),
      credentialPath(CRED_DIR, 'google', name),
    ]) {
      expect(path.dirname(file)).toBe(CRED_DIR);
      expect(path.relative(CRED_DIR, file).startsWith('..')).toBe(false);
    }
    expect(credentialPath(CRED_DIR, 'google', name)).toBe(
      path.join(CRED_DIR, `google-${name}-oauth2.json`),
    );
  });

  it.each(BAD_NAMES)('throws for provider %j', (name) => {
    expect(() => credentialPath(CRED_DIR, name, 'me')).toThrow();
    expect(() => credentialPath(CRED_DIR, 'google', name)).toThrow();
  });
});

describe('OAuth API routes reject invalid names with 400', () => {
  const q = (provider: string, account: string) =>
    `provider=${encodeURIComponent(provider)}&account=${encodeURIComponent(account)}`;

  it.each(BAD_NAMES)('status: %j', async (name) => {
    const res = await app.inject(`/api/oauth/status?${q(name, 'me')}`);
    expect(res.statusCode).toBe(400);
    const res2 = await app.inject(`/api/oauth/status?${q('google', name)}`);
    expect(res2.statusCode).toBe(400);
  });

  it.each(BAD_NAMES)('token: %j', async (name) => {
    const res = await app.inject(`/api/oauth/token?${q(name, 'me')}`);
    expect(res.statusCode).toBe(400);
  });

  it.each(BAD_NAMES)('start: %j', async (name) => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/oauth/start',
      payload: {
        provider: 'github',
        account: name,
        clientId: 'cid',
        clientSecret: 'secret',
        authUrl: 'https://auth.example.com/authorize',
        tokenUrl: 'https://auth.example.com/token',
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it.each(['me', 'jason@johngalt.id', 'a+b@x.io'])(
    'lets %s through to the credential lookup',
    async (account) => {
      const res = await app.inject(`/api/oauth/status?${q('google', account)}`);
      expect(res.statusCode).toBe(200);
      expect(res.json<{ exists: boolean }>().exists).toBe(false);
    },
  );

  it('rejects empty names with 400', async () => {
    expect(
      (await app.inject(`/api/oauth/status?${q('', 'me')}`)).statusCode,
    ).toBe(400);
    expect(
      (await app.inject(`/api/oauth/token?${q('google', '')}`)).statusCode,
    ).toBe(400);
  });

  it('starts a flow for an email-style account', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/oauth/start',
      payload: {
        provider: 'github',
        account: 'jason@johngalt.id',
        clientId: 'cid',
        clientSecret: 'secret',
        authUrl: 'https://auth.example.com/authorize',
        tokenUrl: 'https://auth.example.com/token',
      },
    });
    expect(res.statusCode).toBe(200);
  });
});
