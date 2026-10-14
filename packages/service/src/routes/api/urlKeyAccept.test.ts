/**
 * #279: every route that reads a URL auth key accepts both `k` and the
 * legacy `key`, and `k` wins when both are present. Real HMAC keys.
 *
 * @packageDocumentation
 */

import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  INSIDER_SEED,
  MACHINE_SEED,
  makeRuntimeConfig,
} from '../../testing/authFixture.js';
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

const { addAuthMiddleware } = await import('./middleware.js');
const { authStatusRoutes } = await import('./auth-status.js');
const { keysRoute } = await import('../keys.js');
const { eventRoute } = await import('../event.js');
const { encodeStack } = await import('../../services/deepShareLinks.js');

const echo = (request: FastifyRequest) => ({
  accessMode: request.accessMode ?? null,
});

const CONTENT_PREFIXES = [
  '/api/path',
  '/api/file',
  '/api/raw',
  '/api/export',
  '/api/export-cache',
  '/api/mermaid-export',
  '/api/plantuml-export',
  '/api/link-info',
];

let app: FastifyInstance;

beforeAll(async () => {
  app = Fastify();
  await app.register(async (api) => {
    addAuthMiddleware(api);
    for (const prefix of CONTENT_PREFIXES) api.get(`${prefix}/*`, echo);
    api.post('/api/util/share-for', echo);
    await api.register(authStatusRoutes);
  });
  await app.register(keysRoute);
  await app.register(eventRoute);
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

describe('GET /share accepts k and key', () => {
  const insiderKey = computeInsiderKey(INSIDER_SEED);

  it.each(variants(insiderKey))('%s', async (_label, query, status) => {
    const res = await app.inject(`/share?path=${DOC}&${query}`);
    expect(res.statusCode).toBe(status);
  });
});

describe('POST /rotate-key accepts k and key', () => {
  it.each([
    ['k', 'k'],
    ['key', 'key'],
  ])('machine insider key via %s reaches the key check', async (_l, name) => {
    const res = await app.inject({
      method: 'POST',
      url: `/rotate-key?${name}=${computeInsiderKey(MACHINE_SEED)}`,
    });
    // Machine-key rotation is refused with 501 once the key is recognised.
    expect(res.statusCode).toBe(501);
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
