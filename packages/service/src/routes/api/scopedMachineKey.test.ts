/**
 * Scoped machine keys on insider routes (#289, #301): the access hook verifies the key as an identity, then share and search check the paths they address against its scopes, so the key works within its scopes and is refused outside them. Real hook, handlers and HMAC keys; the watcher is stubbed.
 *
 * @packageDocumentation
 */

import { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { makeRuntimeConfig, scopes } from '../../testing/authFixture.js';
import { serverError, testApp } from '../../testing/testApp.js';
import { computeInsiderKey } from '../../util/crypto.js';

const SCOPED_SEED = 'scoped-machine-seed-0123456789';
const KEY = computeInsiderKey(SCOPED_SEED);
const config = makeRuntimeConfig({
  extraKeys: [
    { name: 'scoped', seed: SCOPED_SEED, scopes: scopes(['/r/docs/**']) },
  ],
});

vi.mock('@karmaniverous/jeeves', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getServiceUrl: () => 'http://watcher.test',
}));
vi.mock('../../config/index.js', () => ({ getConfig: () => config }));
vi.mock('../../util/platform.js', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getRoots: () => [],
  // The watcher reports these already as URL paths in this test.
  fsPathToUrl: (fsPath: string) => fsPath,
}));

const { addAccessHook } = await import('../../api/accessHook.js');
const { searchRoutes } = await import('./search.js');
const { sharingRoutes } = await import('./sharing.js');

const INDEXED = ['/r/docs/a.md', '/r/secret/b.md'];

let app: FastifyInstance;

beforeAll(async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify(
            INDEXED.map((file_path, i) => ({
              id: String(i),
              score: 1 - i / 10,
              payload: { file_path, chunk_text: `text of ${file_path}` },
            })),
          ),
        ),
      ),
    ),
  );
  app = testApp();
  addAccessHook(app);
  await app.register(searchRoutes);
  await app.register(sharingRoutes);
  await app.ready();
});

afterAll(async () => {
  await app.close();
  vi.unstubAllGlobals();
});

describe('a scoped machine key', () => {
  it('shares a path within its scopes, signed with its seed (#289)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/share?k=${KEY}`,
      payload: { path: '/r/docs/a.md' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ path: string }>().path).toBe('/r/docs/a.md');
  });

  it('is refused sharing a path outside its scopes', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/share?k=${KEY}`,
      payload: { path: '/r/secret/b.md' },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual(
      serverError('SERVER_OUT_OF_SCOPE', 'Path is outside your access scope'),
    );
  });

  it('searches, seeing only results within its scopes', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/search?k=${KEY}`,
      payload: { query: 'a', limit: 10 },
    });
    expect(res.statusCode).toBe(200);
    const paths = res
      .json<{ results: { browsePath: string }[] }>()
      .results.map((r) => r.browsePath);
    expect(paths).toEqual(['r/docs/a.md']);
  });
});
