// @vitest-environment node
/**
 * Runner job IDs that would leave `/jobs/<id>` (Decision 28): `.` and `..`, plain or percent-encoded, and control characters such as `%00`, sent over real HTTP so no client normalises them, are refused 400 on every job route and never reach the runner; the proxy's own `jobPath` check refuses them too when called past the catalog.
 *
 * @packageDocumentation
 */

import http from 'node:http';
import type { AddressInfo } from 'node:net';

import type * as Jeeves from '@karmaniverous/jeeves';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { catalogRoutes } from '../../testing/catalogRoutes.js';
import { testApp } from '../../testing/testApp.js';

vi.mock('@karmaniverous/jeeves', async (importOriginal) => ({
  ...(await importOriginal<JeevesModule>()),
  getServiceUrl: vi.fn(() => 'http://runner.test'),
}));

type JeevesModule = typeof Jeeves;

vi.mock('./scopeGuard.js', () => ({ requireInsider: vi.fn() }));

const { runnerHandlers } = await import('./runner.js');

const fetchMock = vi.fn();

let app: FastifyInstance;
let port: number;

beforeAll(async () => {
  vi.stubGlobal('fetch', fetchMock);
  app = testApp();
  await app.register(catalogRoutes(runnerHandlers));
  await app.listen({ port: 0, host: '127.0.0.1' });
  ({ port } = app.server.address() as AddressInfo);
});

afterAll(async () => {
  vi.unstubAllGlobals();
  await app.close();
});

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(
    new Response('{"ok":true}', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  );
});

/** Send a raw request path over HTTP, untouched by any URL parser. */
const send = (method: string, path: string) =>
  new Promise<{ status: number; body: string }>((resolve, reject) => {
    http
      .request({ host: '127.0.0.1', port, method, path }, (res) => {
        let body = '';
        res.on('data', (chunk: Buffer) => (body += chunk.toString()));
        res.on('end', () => {
          resolve({ status: res.statusCode ?? 0, body });
        });
      })
      .on('error', reject)
      .end();
  });

const ROUTES = [
  ['GET', ''],
  ['GET', '/runs'],
  ['POST', '/run'],
  ['PATCH', '/enable'],
  ['PATCH', '/disable'],
] as const;

const IDS = ['%2e%2e', '%2E%2e', '..', '%2e', '.', '%00', 'a%00b', 'a%0Ab'];

const CASES = ROUTES.flatMap(([method, tail]) =>
  IDS.map((id) => [method, `/api/runner/jobs/${id}${tail}`] as const),
);

describe('dot-segment and control-character runner job IDs over real HTTP', () => {
  it.each(CASES)(
    '%s %s is a 400 that never reaches the runner',
    async (method, path) => {
      const res = await send(method, path);

      expect([path, res.status]).toEqual([path, 400]);
      // The catalog's `:id` schema refuses it, before the handler runs.
      expect(JSON.parse(res.body)).toMatchObject({
        code: 'FST_ERR_VALIDATION',
      });
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it('still forwards an ordinary ID over real HTTP', async () => {
    const res = await send('POST', '/api/runner/jobs/nightly/run');

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
      'http://runner.test/jobs/nightly/run',
      { method: 'POST' },
    );
  });
});

describe('jobPath past the catalog', () => {
  const request = {} as FastifyRequest;

  it.each([
    '',
    '.',
    '..',
    'a/b',
    'a\\b',
    '\u0000',
    'a\u0000b',
    'a\nb',
    'a\u007fb',
  ])('refuses job ID %j with SERVER_INVALID_REQUEST', async (id) => {
    await expect(async () =>
      runnerHandlers.runnerGetJob({ params: { id } } as never, request),
    ).rejects.toMatchObject({ code: 'SERVER_INVALID_REQUEST' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
