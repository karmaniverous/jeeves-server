/**
 * #282: share-for outsider links verify at every depth, including depth 0
 * (which used to omit `d`, so the deep key was never recognised).
 * Real middleware and HMAC keys end to end.
 *
 * @packageDocumentation
 */

import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { MACHINE_SEED, makeRuntimeConfig } from '../../testing/authFixture.js';
import { computeInsiderKey } from '../../util/crypto.js';

const config = makeRuntimeConfig();

vi.mock('../../config/index.js', () => ({
  getConfig: () => config,
  resetConfig: vi.fn(),
}));
vi.mock('../../util/configPersist.js', () => ({
  writeInsiderSeedToConfig: vi.fn(),
}));

const { addAuthMiddleware } = await import('./middleware.js');
const { sharingRoutes } = await import('./sharing.js');

let app: FastifyInstance;

beforeAll(async () => {
  app = Fastify();
  await app.register(async (api) => {
    addAuthMiddleware(api);
    api.get('/api/file/*', (request: FastifyRequest) => ({
      accessMode: request.accessMode ?? null,
    }));
    await api.register(sharingRoutes);
  });
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

const DOC = '/r/docs/a.md';

/** Create a share-for link for an outsider audience. */
async function shareFor(body: Record<string, unknown>): Promise<URL> {
  const res = await app.inject({
    method: 'POST',
    url: `/api/util/share-for?k=${computeInsiderKey(MACHINE_SEED)}`,
    payload: { path: DOC, insiders: ['outsider@example.com'], ...body },
  });
  expect(res.statusCode).toBe(200);
  const json = res.json<{ url: string; type: string }>();
  expect(json.type).toBe('outsider-share');
  return new URL(json.url);
}

describe('share-for outsider links (#282)', () => {
  it.each([
    ['depth omitted', {}, '0'],
    ['depth 0 with dirs', { depth: 0, dirs: true }, '0'],
    ['depth 2', { depth: 2 }, '2'],
  ])('%s: link carries d and opens the shared file', async (_l, body, d) => {
    const url = await shareFor(body);
    expect(url.searchParams.get('d')).toBe(d);

    const res = await app.inject(`/api/file${DOC}${url.search}`);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ accessMode: 'outsider' });
  });
});
