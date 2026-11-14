/**
 * Search routes against a mocked watcher SDK client: request mapping and
 * budgets, and the replies when the watcher answers an error, refuses a
 * request or cannot be reached.
 *
 * @packageDocumentation
 */

import { CatalogClientError } from '@karmaniverous/jeeves/catalog';
import { type FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { makeRuntimeConfig } from '../../testing/authFixture.js';
import { catalogRoutes } from '../../testing/catalogRoutes.js';
import { serverError, testApp } from '../../testing/testApp.js';

const search = vi.hoisted(() => vi.fn());
const listFacets = vi.hoisted(() => vi.fn());
const createWatcherClient = vi.hoisted(() =>
  vi.fn(() => ({ search, listFacets })),
);

vi.mock('@karmaniverous/jeeves', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getServiceUrl: () => 'http://watcher.test',
}));
vi.mock('@karmaniverous/jeeves-watcher-sdk', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  createWatcherClient,
}));
vi.mock('../../config/index.js', () => ({
  getConfig: () => makeRuntimeConfig(),
}));
vi.mock('../../util/platform.js', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getRoots: () => [],
  fsPathToUrl: (fsPath: string) => fsPath,
}));

const { WatcherError } = await import('@karmaniverous/jeeves-watcher-sdk');
const { createSearchHandlers } = await import('./search.js');

const unreachable = new WatcherError({
  code: 'network_error',
  message: 'request failed: fetch failed',
  cause: new CatalogClientError('request failed', {
    status: 0,
    cause: new TypeError('fetch failed'),
  }),
});

let app: FastifyInstance;

beforeEach(async () => {
  search.mockReset();
  listFacets.mockReset();
  createWatcherClient.mockClear();
  app = testApp();
  app.addHook('preHandler', (request, _reply, done) => {
    request.accessMode = 'insider';
    request.insiderScopes = null;
    done();
  });
  await app.register(catalogRoutes(createSearchHandlers()));
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

const postSearch = (payload: object) =>
  app.inject({ method: 'POST', url: '/api/search', payload });
const getFacets = () =>
  app.inject({ method: 'GET', url: '/api/search/facets' });

describe('POST /api/search', () => {
  it('over-fetches through the SDK within the search budget', async () => {
    search.mockResolvedValue([
      {
        id: '1',
        score: 0.9,
        payload: { file_path: '/r/a.md', chunk_text: 't' },
      },
    ]);
    const res = await postSearch({
      query: 'q',
      limit: 3,
      filter: { must: [] },
    });
    expect(res.statusCode).toBe(200);
    expect(createWatcherClient).toHaveBeenCalledWith({
      baseUrl: 'http://watcher.test',
      timeoutMs: 30_000,
    });
    expect(search).toHaveBeenCalledWith({
      query: 'q',
      limit: 15,
      filter: { must: [] },
    });
    expect(
      res.json<{ results: { browsePath: string }[] }>().results,
    ).toMatchObject([{ browsePath: 'r/a.md' }]);
  });

  it('caps the over-fetch at 200', async () => {
    search.mockResolvedValue([]);
    await postSearch({ query: 'q', limit: 100 });
    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 200 }),
    );
  });

  it('rejects a missing query without calling the watcher', async () => {
    const res = await postSearch({});
    expect(res.statusCode).toBe(400);
    // The catalog's request validation refuses it before the handler.
    expect(res.json()).toMatchObject({ code: 'FST_ERR_VALIDATION' });
    expect(search).not.toHaveBeenCalled();
  });

  it('reports an error the watcher answered', async () => {
    search.mockRejectedValue(
      new WatcherError({
        code: 'http_500',
        message: 'index down',
        status: 500,
      }),
    );
    const res = await postSearch({ query: 'q' });
    expect(res.statusCode).toBe(502);
    expect(res.json()).toEqual(
      serverError(
        'SERVER_WATCHER_UNAVAILABLE',
        'Watcher search failed: index down',
      ),
    );
  });

  it('reports a request the SDK refused as a failed search', async () => {
    search.mockRejectedValue(
      new WatcherError({ code: 'invalid_request', message: 'bad limit' }),
    );
    // A limit the catalog admits but the watcher refuses.
    const res = await postSearch({ query: 'q', limit: 7 });
    expect(res.json()).toEqual(
      serverError(
        'SERVER_WATCHER_UNAVAILABLE',
        'Watcher search failed: bad limit',
      ),
    );
  });

  it('reports an unreachable watcher, keeping the transport error internal', async () => {
    search.mockRejectedValue(unreachable);
    const res = await postSearch({ query: 'q' });
    expect(res.statusCode).toBe(502);
    expect(res.json()).toEqual(
      serverError('SERVER_WATCHER_UNAVAILABLE', 'Watcher unreachable'),
    );
  });
});

describe('GET /api/search/facets', () => {
  const facets = { facets: [] };

  it('returns the facets and serves repeats from cache', async () => {
    listFacets.mockResolvedValue(facets);
    expect((await getFacets()).json()).toEqual(facets);
    expect((await getFacets()).json()).toEqual(facets);
    expect(listFacets).toHaveBeenCalledExactlyOnceWith({});
    expect(createWatcherClient).toHaveBeenCalledWith({
      baseUrl: 'http://watcher.test',
      timeoutMs: 15_000,
    });
  });

  it.each([
    [
      'an HTTP error',
      new WatcherError({ code: 'http_503', message: 'busy', status: 503 }),
      'Watcher facets failed: busy',
    ],
    [
      'an unparseable answer',
      new WatcherError({
        code: 'invalid_response',
        message: 'listFacets response did not match the expected shape',
        status: 200,
      }),
      'Watcher facets failed: listFacets response did not match the expected shape',
    ],
    ['an unreachable watcher', unreachable, 'Watcher unreachable'],
  ])('answers 502 on %s', async (_label, err, detail) => {
    listFacets.mockRejectedValue(err);
    const res = await getFacets();
    expect(res.statusCode).toBe(502);
    expect(res.json()).toEqual(
      serverError('SERVER_WATCHER_UNAVAILABLE', detail),
    );
  });

  it('retries after a failure instead of caching it', async () => {
    listFacets.mockRejectedValueOnce(unreachable).mockResolvedValue(facets);
    expect((await getFacets()).statusCode).toBe(502);
    expect((await getFacets()).json()).toEqual(facets);
  });
});
