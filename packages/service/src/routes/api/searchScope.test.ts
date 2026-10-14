/**
 * Search results are filtered with canAccessPath, the matcher content routes
 * use: globs match dot segments, and explicit overrides take precedence.
 *
 * @packageDocumentation
 */

import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import type { NormalizedScopes } from '../../config/types.js';
import { makeRuntimeConfig } from '../../testing/authFixture.js';

const state = vi.hoisted((): { scopes: unknown } => ({ scopes: null }));

vi.mock('@karmaniverous/jeeves', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getServiceUrl: () => 'http://watcher.test',
}));
vi.mock('../../config/index.js', () => ({
  getConfig: () => makeRuntimeConfig(),
}));
vi.mock('../../util/platform.js', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getRoots: () => [],
  // The watcher reports these already as URL paths in this test.
  fsPathToUrl: (fsPath: string) => fsPath,
}));

const { searchRoutes } = await import('./search.js');

const INDEXED = [
  '/r/.notes/private-plan.md',
  '/r/.notes/ideas.md',
  '/r/private/.env',
  '/r/docs/a.md',
  '/r/secret/explicit.md',
  '/r/docs/hidden.md',
];

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
  app = Fastify();
  app.addHook('preHandler', (request, _reply, done) => {
    request.accessMode = 'insider';
    request.insiderScopes = state.scopes as NormalizedScopes | null;
    done();
  });
  await app.register(searchRoutes);
  await app.ready();
});

afterAll(async () => {
  await app.close();
  vi.unstubAllGlobals();
});

/** Search as an insider with `scopes`; return the result paths. */
async function searchAs(scopes: NormalizedScopes | null): Promise<string[]> {
  state.scopes = scopes;
  const res = await app.inject({
    method: 'POST',
    url: '/api/search',
    payload: { query: 'plan', limit: 50 },
  });
  expect(res.statusCode).toBe(200);
  const body = res.json<{ results: { browsePath: string }[] }>();
  return body.results.map((r) => `/${r.browsePath}`).sort();
}

describe('search scope filtering', () => {
  it('excludes a dot path a crossing deny glob covers', async () => {
    const results = await searchAs({
      allow: ['/r/.notes/**'],
      deny: ['/r/**/private*'],
      explicitAllow: [],
      explicitDeny: [],
    });
    expect(results).toEqual(['/r/.notes/ideas.md']);
  });

  it('includes in-scope dot files under a ** allow', async () => {
    const results = await searchAs({
      allow: ['/r/**'],
      deny: [],
      explicitAllow: [],
      explicitDeny: [],
    });
    expect(results).toContain('/r/private/.env');
    expect(results).toContain('/r/.notes/ideas.md');
  });

  it('lets an explicit allow override a named deny', async () => {
    const results = await searchAs({
      allow: ['/r/docs/**', '/r/secret/explicit.md'],
      deny: ['/r/secret/**'],
      explicitAllow: ['/r/secret/explicit.md'],
      explicitDeny: [],
    });
    expect(results).toContain('/r/secret/explicit.md');
  });

  it('lets an explicit deny override a named allow', async () => {
    const results = await searchAs({
      allow: ['/r/docs/**'],
      deny: ['/r/docs/hidden.md'],
      explicitAllow: [],
      explicitDeny: ['/r/docs/hidden.md'],
    });
    expect(results).toEqual(['/r/docs/a.md']);
  });

  it('leaves unscoped insiders unfiltered', async () => {
    expect(await searchAs(null)).toEqual([...INDEXED].sort());
  });
});
