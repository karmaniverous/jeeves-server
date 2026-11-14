/**
 * The access matrix (Decision 8): every access class against every kind of credential (none, sessions in and out of scope, unscoped and scoped machine keys, the insider-seed key, valid and invalid share keys, deep keys), with the status and code the access hook answers. Real hook, HMAC keys and sessions; echo handlers.
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
import { testApp } from '../testing/testApp.js';
import {
  computeDeepShareKey,
  computeInsiderKey,
  computePathKey,
} from '../util/crypto.js';

const SECRET = 's'.repeat(64);
const SCOPED_EMAIL = 'scoped@example.com';
const SCOPED_SEED = 'scoped-insider-seed-0123456789';
const SCOPED_MACHINE_SEED = 'scoped-machine-seed-0123456789';
const ALL_MACHINE_SEED = 'all-machine-seed-0123456789';
const IN = '/r/in/a.md';
const OUT = '/r/out/b.md';

const config = makeRuntimeConfig({
  extraKeys: [
    { name: 'scoped', seed: SCOPED_MACHINE_SEED, scopes: scopes(['/r/in/**']) },
    { name: 'all', seed: ALL_MACHINE_SEED, scopes: scopes(['/**']) },
  ],
  extraInsiders: [
    {
      email: SCOPED_EMAIL,
      seed: SCOPED_SEED,
      scopes: scopes(['/r/in/**']),
      keyCreatedAt: null,
    },
  ],
  overrides: { sessionSecret: SECRET },
});

vi.mock('../config/index.js', () => ({ getConfig: () => config }));

const { addAccessHook } = await import('./accessHook.js');
const { encodeStack } = await import('../services/deepShareStack.js');

/** What a request carries. */
interface Cred {
  query?: (path: string) => string;
  cookie?: string;
}

const session = (email: string): Cred => ({
  cookie: createSessionCookie(email, SECRET),
});
const key = (k: string): Cred => ({ query: () => `k=${k}` });

/** Credential kinds by label. */
const CREDS: Record<string, Cred> = {
  none: {},
  session: session(INSIDER_EMAIL),
  'scoped session': session(SCOPED_EMAIL),
  'machine key': key(computeInsiderKey(MACHINE_SEED)),
  'scoped machine key': key(computeInsiderKey(SCOPED_MACHINE_SEED)),
  "machine key allow '/**'": key(computeInsiderKey(ALL_MACHINE_SEED)),
  'insider-seed key': key(computeInsiderKey(INSIDER_SEED)),
  'share key': { query: (p) => `k=${computePathKey(INSIDER_SEED, p)}` },
  'invalid share key': key('0'.repeat(32)),
  'deep key': {
    query: (p) => {
      const s = encodeStack([p]);
      const k = computeDeepShareKey(INSIDER_SEED, p, {
        depth: 1,
        dirs: false,
        stack: s,
      });
      return `k=${k}&d=1&dirs=0&s=${encodeURIComponent(s)}`;
    },
  },
};

/** Outcome: a status, plus the access mode (2xx) or the code (errors). */
type Outcome = [number, string];

const OK_IN: Outcome = [200, 'insider'];
const OK_OUT: Outcome = [200, 'outsider'];
const E401: Outcome = [401, 'SERVER_UNAUTHORIZED'];
const E403_SCOPE: Outcome = [403, 'SERVER_OUT_OF_SCOPE'];
const E403_INSIDER: Outcome = [403, 'SERVER_INSIDER_REQUIRED'];
const E403_ADMIN: Outcome = [403, 'SERVER_FORBIDDEN'];

/** One row: credential label, content path, expected per class. */
type Row = [string, string, Record<string, Outcome>];

/** The class representatives. */
const ROUTES: Record<string, { method: 'GET' | 'PUT' | 'POST'; url: string }> =
  {
    navigation: { method: 'GET', url: '/api/path' },
    content: { method: 'GET', url: '/api/file' },
    'content+insider': { method: 'PUT', url: '/api/file' },
    insider: { method: 'POST', url: '/api/search' },
    'insider (loginSeedKey)': { method: 'POST', url: '/api/util/share-for' },
    admin: { method: 'GET', url: '/config' },
  };

const all = (outcome: Outcome, overrides: Record<string, Outcome> = {}) => ({
  ...Object.fromEntries(Object.keys(ROUTES).map((r) => [r, outcome])),
  ...overrides,
});

const MATRIX: Row[] = [
  ['none', IN, all(E401)],
  ['session', IN, all(OK_IN)],
  ['scoped session', IN, all(OK_IN, { admin: E403_ADMIN })],
  [
    'scoped session',
    OUT,
    all(OK_IN, {
      navigation: E403_SCOPE,
      content: E403_SCOPE,
      'content+insider': E403_SCOPE,
      admin: E403_ADMIN,
    }),
  ],
  [
    'scoped session',
    '/r',
    all(OK_IN, {
      content: E403_SCOPE,
      'content+insider': E403_SCOPE,
      admin: E403_ADMIN,
    }),
  ],
  ['machine key', IN, all(OK_IN)],
  ['scoped machine key', IN, all(OK_IN, { admin: E403_ADMIN })],
  [
    'scoped machine key',
    OUT,
    all(OK_IN, {
      navigation: E403_SCOPE,
      content: E403_SCOPE,
      'content+insider': E403_SCOPE,
      admin: E403_ADMIN,
    }),
  ],
  [
    'scoped machine key',
    '/r',
    all(OK_IN, {
      content: E403_SCOPE,
      'content+insider': E403_SCOPE,
      admin: E403_ADMIN,
    }),
  ],
  ["machine key allow '/**'", IN, all(OK_IN, { admin: E403_ADMIN })],
  ['insider-seed key', IN, all(E401, { 'insider (loginSeedKey)': OK_IN })],
  [
    'share key',
    IN,
    all(E401, {
      navigation: OK_OUT,
      content: OK_OUT,
      'content+insider': E403_INSIDER,
    }),
  ],
  ['invalid share key', IN, all(E401)],
  [
    'deep key',
    IN,
    all(E401, {
      navigation: OK_OUT,
      content: OK_OUT,
      'content+insider': E403_INSIDER,
    }),
  ],
];

const echo = (request: FastifyRequest) => ({
  accessMode: request.accessMode ?? null,
});

let app: FastifyInstance;

beforeAll(async () => {
  app = testApp();
  await app.register(cookie);
  addAccessHook(app);
  app.get('/api/path/*', echo);
  app.get('/api/file/*', echo);
  app.put('/api/file/*', echo);
  app.post('/api/search', echo);
  app.post('/api/util/share-for', echo);
  app.get('/config', echo);
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

/** Send `route` for `path` with credential `label`. */
async function send(route: string, path: string, label: string) {
  const { method, url } = ROUTES[route];
  const cred = CREDS[label];
  const addressed = url.startsWith('/api/path') || url.startsWith('/api/file');
  const query = cred.query?.(path);
  return app.inject({
    method,
    url: `${url}${addressed ? path : ''}${query ? `?${query}` : ''}`,
    ...(cred.cookie ? { cookies: { [COOKIE_NAME]: cred.cookie } } : {}),
    ...(method === 'GET' ? {} : { payload: {} }),
  });
}

const cases = MATRIX.flatMap(([label, path, expected]) =>
  Object.entries(expected).map(
    ([route, outcome]) => [route, label, path, outcome] as const,
  ),
);

describe('access matrix', () => {
  it.each(cases)('%s, %s on %s', async (route, label, path, outcome) => {
    const res = await send(route, path, label);
    const body = res.json<{ accessMode?: string; code?: string }>();
    const detail = res.statusCode === 200 ? body.accessMode : body.code;
    expect([res.statusCode, detail]).toEqual(outcome);
  });

  it('falls back to a valid share key when a session is out of scope', async () => {
    const res = await app.inject({
      url: `/api/file${OUT}?k=${computePathKey(INSIDER_SEED, OUT)}`,
      cookies: { [COOKIE_NAME]: createSessionCookie(SCOPED_EMAIL, SECRET) },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ accessMode: 'outsider' });
  });

  it('refuses that fallback on content+insider entries', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/api/file${OUT}?k=${computePathKey(INSIDER_SEED, OUT)}`,
      cookies: { [COOKIE_NAME]: createSessionCookie(SCOPED_EMAIL, SECRET) },
      payload: {},
    });
    expect(res.statusCode).toBe(403);
    expect(res.json<{ code: string }>().code).toBe('SERVER_INSIDER_REQUIRED');
  });

  it("refuses a share key signed by a scoped insider outside the signer's scopes", async () => {
    const res = await app.inject(
      `/api/file${OUT}?k=${computePathKey(SCOPED_SEED, OUT)}`,
    );
    expect(res.statusCode).toBe(401);
  });
});
