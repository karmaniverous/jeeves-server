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
  'a..b',
  '../etc',
  'a/b',
  'a\\b',
  '/abs',
  'C:\\abs',
  'user@example.com',
  'with space',
];

describe('isValidCredentialName', () => {
  it.each(['google', 'x', 'salesforce-prod', 'my.account_1'])(
    'accepts %s',
    (name) => {
      expect(isValidCredentialName(name)).toBe(true);
    },
  );

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

  it('lets a valid name through to the credential lookup', async () => {
    const res = await app.inject(`/api/oauth/status?${q('google', 'me')}`);
    expect(res.statusCode).toBe(200);
    expect(res.json<{ exists: boolean }>().exists).toBe(false);
  });
});
