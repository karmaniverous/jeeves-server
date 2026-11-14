/**
 * #279: every route that reads a URL auth key accepts both `k` and the
 * legacy `key`, and `k` wins when both are present. Real HMAC keys.
 *
 * @packageDocumentation
 */
import { type FastifyInstance, type FastifyRequest } from 'fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  INSIDER_SEED,
  MACHINE_SEED,
  makeRuntimeConfig,
} from '../../testing/authFixture.js';
import { catalogRoutes } from '../../testing/catalogRoutes.js';
import { testApp } from '../../testing/testApp.js';
import {
  computeDeepShareKey,
  computeInsiderKey,
  computePathKey,
} from '../../util/crypto.js';

const config = makeRuntimeConfig();

vi.mock('../../config/index.js', () => ({
  getConfig: () => config,
  resetConfig: vi.fn(),
}));
vi.mock('../../services/eventLog.js', () => ({ logEvent: vi.fn() }));
vi.mock('../../services/eventQueue.js', () => ({
  enqueue: vi.fn(),
  appendEvent: vi.fn(),
}));
vi.mock('../../util/configPersist.js', () => ({
  writeInsiderSeedToConfig: vi.fn(),
}));

const { addAccessHook } = await import('../../api/accessHook.js');
const { authStatusHandlers } = await import('./auth-status.js');
const { keysHandlers } = await import('../keys.js');
const { eventHandlers } = await import('../event.js');
const { encodeStack } = await import('../../services/deepShareStack.js');

const echo = (request: FastifyRequest) => ({
  accessMode: request.accessMode ?? null,
});

const CONTENT_PREFIXES = [
  '/api/path',
  '/api/file',
  '/api/raw',
  '/api/export',
  '/api/mermaid-export',
  '/api/plantuml-export',
  '/api/link-info',
];

let app: FastifyInstance;

beforeAll(async () => {
  app = testApp();
  addAccessHook(app);
  await app.register(async (api) => {
    for (const prefix of CONTENT_PREFIXES) api.get(`${prefix}/*`, echo);
    api.post('/api/util/share-for', echo);
    await api.register(catalogRoutes(authStatusHandlers));
    api.post('/api/rotate-key', echo);
  });
  await app.register(catalogRoutes(keysHandlers));
  await app.register(catalogRoutes(eventHandlers));
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

const DOC = '/r/docs/a.md';
const outsiderKey = computePathKey(INSIDER_SEED, DOC);
const BOGUS = '0'.repeat(32);

/** Query strings carrying `good` under each name, and both orders of mixing. */
const variants = (good: string) =>
  [
    ['k alone', `k=${good}`, 200],
    ['key alone', `key=${good}`, 200],
    ['both, k valid', `k=${good}&key=${BOGUS}`, 200],
    ['both, only key valid (k wins)', `k=${BOGUS}&key=${good}`, 401],
  ] as const;

describe('content routes accept k and key', () => {
  for (const prefix of CONTENT_PREFIXES) {
    it.each(variants(outsiderKey))(
      `${prefix}: %s`,
      async (_label, query, status) => {
        const res = await app.inject(`${prefix}${DOC}?${query}`);
        expect(res.statusCode).toBe(status);
        expect(res.statusCode === 200 ? res.json() : null).toEqual(
          status === 200 ? { accessMode: 'outsider' } : null,
        );
      },
    );
  }
});

describe('deep share keys accept k and key', () => {
  const stack = encodeStack([DOC]);
  const deepKey = computeDeepShareKey(INSIDER_SEED, DOC, {
    depth: 1,
    dirs: false,
    stack,
  });

  it.each(variants(deepKey))('%s', async (_label, query, status) => {
    const res = await app.inject(
      `/api/file${DOC}?${query}&d=1&dirs=0&s=${stack}`,
    );
    expect(res.statusCode).toBe(status);
  });
});

describe('utility routes accept k and key', () => {
  const insiderKey = computeInsiderKey(MACHINE_SEED);

  it.each(variants(insiderKey))('%s', async (_label, query, status) => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/util/share-for?${query}`,
      payload: {},
    });
    expect(res.statusCode).toBe(status);
  });
});

describe('/api/auth/status accepts k and key', () => {
  it.each(variants(outsiderKey))('%s', async (_label, query, status) => {
    const res = await app.inject(`/api/auth/status?path=${DOC}&${query}`);
    expect(res.statusCode).toBe(200);
    expect(res.json<{ authenticated: boolean }>().authenticated).toBe(
      status === 200,
    );
  });
});

describe('POST /api/rotate-key accepts k and key', () => {
  it.each([
    ['k', 'k'],
    ['key', 'key'],
  ])('a machine insider key via %s is an identity', async (_l, name) => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/rotate-key?${name}=${computeInsiderKey(MACHINE_SEED)}`,
    });
    // The handler then refuses it (rotateKey.test.ts).
    expect(res.json()).toEqual({ accessMode: 'insider' });
  });
});

describe('the legacy routes are gone (#292)', () => {
  it.each([
    ['POST', '/rotate-key'],
    ['GET', `/share?path=${DOC}`],
  ] as const)('%s %s is not a route', async (method, url) => {
    const res = await app.inject({ method, url });
    expect(res.statusCode).toBe(404);
  });
});

describe('/event accepts k and key', () => {
  const eventKey = computePathKey(MACHINE_SEED, '/event');

  it.each(variants(eventKey))('%s', async (_label, query, status) => {
    const res = await app.inject({
      method: 'POST',
      url: `/event?${query}`,
      payload: { hello: 'world' },
    });
    expect(res.statusCode).toBe(status);
  });
});
