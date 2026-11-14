/**
 * The access hook beyond the class matrix: public entries resolve identity opportunistically, the key-exchange and webhook entries verify their machine seed and event key, `..` segments, what the hook records on the request, and the routes it leaves alone. Real hook, HMAC keys and sessions; echo handlers.
 *
 * @packageDocumentation
 */

import cookie from '@fastify/cookie';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { COOKIE_NAME, createSessionCookie } from '../auth/session.js';
import {
  INSIDER_EMAIL,
  INSIDER_SEED,
  MACHINE_SEED,
  makeRuntimeConfig,
  scopes,
} from '../testing/authFixture.js';
import { serverError, testApp } from '../testing/testApp.js';
import { computeInsiderKey, computePathKey } from '../util/crypto.js';

const SECRET = 's'.repeat(64);
const SCOPED_MACHINE_SEED = 'scoped-machine-seed-0123456789';

const config = makeRuntimeConfig({
  extraKeys: [
    { name: 'scoped', seed: SCOPED_MACHINE_SEED, scopes: scopes(['/r/**']) },
  ],
  overrides: { sessionSecret: SECRET },
});

vi.mock('../config/index.js', () => ({ getConfig: () => config }));

const { addAccessHook, isAdmin } = await import('./accessHook.js');
const { machineSeedOf } = await import('../routes/keys.js');

const echo = (request: FastifyRequest) => ({
  access: request.access ?? null,
  accessMode: request.accessMode ?? null,
  authSeed: request.authSeed ?? null,
  insiderEmail: request.insiderEmail ?? null,
  keyAge: request.keyAge,
  authMatchedPath: request.authMatchedPath,
  admin: isAdmin(request),
});

let app: FastifyInstance;

beforeAll(async () => {
  app = testApp();
  await app.register(cookie);
  addAccessHook(app);
  app.get('/api/auth/status', echo);
  app.get('/insider-key', echo);
  app.post('/event', echo);
  app.get('/api/file/*', echo);
  app.get('/api/path/*', echo);
  app.post('/api/util/share-for', echo);
  app.get('/browse/*', echo);
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

const sessionCookie = {
  [COOKIE_NAME]: createSessionCookie(INSIDER_EMAIL, SECRET),
};

describe('public entries', () => {
  it('admit a caller without credentials', async () => {
    const res = await app.inject('/api/auth/status');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      access: { entry: 'authStatus', class: 'public' },
      accessMode: null,
      admin: false,
    });
  });

  it.each([
    ['an invalid key', 'k=nope'],
    [
      'an insider-seed key (no loginSeedKey)',
      `k=${computeInsiderKey(INSIDER_SEED)}`,
    ],
    ['a share key', `k=${computePathKey(INSIDER_SEED, '/r/a.md')}`],
  ])('never fail on %s, resolving no identity', async (_label, query) => {
    const res = await app.inject(`/api/auth/status?${query}`);
    expect(res.statusCode).toBe(200);
    expect(res.json<{ access: object }>().access).toEqual({
      entry: 'authStatus',
      class: 'public',
    });
  });

  it('resolve a session as an admin identity', async () => {
    const res = await app.inject({
      url: '/api/auth/status',
      cookies: sessionCookie,
    });
    expect(res.json()).toMatchObject({
      access: { identity: { kind: 'session', name: INSIDER_EMAIL } },
      accessMode: 'insider',
      insiderEmail: INSIDER_EMAIL,
      keyAge: null,
      admin: true,
    });
  });

  it('resolve a scoped machine key, not an admin', async () => {
    const res = await app.inject(
      `/api/auth/status?k=${computeInsiderKey(SCOPED_MACHINE_SEED)}`,
    );
    expect(res.json()).toMatchObject({
      access: { identity: { kind: 'machineKey', name: 'scoped' } },
      authSeed: SCOPED_MACHINE_SEED,
      insiderEmail: null,
      admin: false,
    });
  });
});

describe('machineSeed entries', () => {
  it('admit the raw machine seed in X-API-Key', async () => {
    const res = await app.inject({
      url: '/insider-key',
      headers: { 'x-api-key': MACHINE_SEED },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      access: { class: 'machineSeed', machineKey: 'machine' },
      authSeed: MACHINE_SEED,
    });
  });

  it.each([
    ['no header', {}, 'X-API-Key header required'],
    ['a wrong seed', { 'x-api-key': 'wrong' }, 'Invalid API key'],
    ['an insider seed', { 'x-api-key': INSIDER_SEED }, 'Invalid API key'],
  ])('refuse %s', async (_label, headers, error) => {
    const res = await app.inject({
      url: `/insider-key?k=${computeInsiderKey(MACHINE_SEED)}`,
      headers,
    });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual(serverError('SERVER_UNAUTHORIZED', error));
  });
});

describe('machineSeedOf', () => {
  it('refuses a request the hook matched no machine seed for', () => {
    expect(() => machineSeedOf({} as FastifyRequest)).toThrow(
      'X-API-Key header required',
    );
  });
});

describe('eventKey entries', () => {
  it.each([
    ['a machine path key for /event', computePathKey(MACHINE_SEED, '/event')],
    ['an unscoped machine insider key', computeInsiderKey(MACHINE_SEED)],
  ])('admit %s', async (_label, key) => {
    const res = await app.inject({ method: 'POST', url: `/event?k=${key}` });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      access: { class: 'eventKey', machineKey: 'machine' },
    });
  });

  it.each([
    ['no key', ''],
    [
      'a scoped machine insider key',
      `?k=${computeInsiderKey(SCOPED_MACHINE_SEED)}`,
    ],
    ['an insider path key', `?k=${computePathKey(INSIDER_SEED, '/event')}`],
  ])('refuse %s', async (_label, query) => {
    const res = await app.inject({ method: 'POST', url: `/event${query}` });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual(
      serverError('SERVER_UNAUTHORIZED', 'Unauthorized'),
    );
  });
});

describe('content paths', () => {
  it('refuse a .. segment before any credential', async () => {
    const res = await app.inject({
      url: '/api/file/r%2F..%2Fsecret.md',
      cookies: sessionCookie,
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual(
      serverError('SERVER_INVALID_PATH', 'Invalid path'),
    );
  });

  it('record the ancestor a share key matched', async () => {
    const res = await app.inject(
      `/api/file/r/docs/a.md?k=${computePathKey(INSIDER_SEED, '/r/docs')}`,
    );
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      accessMode: 'outsider',
      authSeed: INSIDER_SEED,
      authMatchedPath: '/r/docs',
      admin: false,
    });
  });

  it('record a session with its key age', async () => {
    const res = await app.inject({
      url: '/api/path/r',
      cookies: sessionCookie,
    });
    expect(res.json()).toMatchObject({
      access: { entry: 'browse', class: 'navigation' },
      accessMode: 'insider',
      keyAge: null,
    });
  });
});

describe('loginSeedKey entries', () => {
  it('record the insider-seed key as an identity with its email', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/util/share-for?k=${computeInsiderKey(INSIDER_SEED)}`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      access: { identity: { kind: 'loginSeedKey', name: INSIDER_EMAIL } },
      insiderEmail: INSIDER_EMAIL,
      authSeed: INSIDER_SEED,
    });
  });
});

describe('routes outside the catalog', () => {
  it('pass browser routes through untouched', async () => {
    const res = await app.inject('/browse/r/a.md');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ access: null, accessMode: null });
  });

  it('leave unregistered catalog URLs to the 404 handler', async () => {
    const res = await app.inject('/api/search/facets');
    expect(res.statusCode).toBe(404);
  });
});
