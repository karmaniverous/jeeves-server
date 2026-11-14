/**
 * The runner pass-through (`/api/runner/*`): method, path, query (without credentials) and body go to the runner; its status, body, content type and Retry-After come back (#315).
 *
 * @packageDocumentation
 */

import type * as Jeeves from '@karmaniverous/jeeves';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { catalogRoutes } from '../../testing/catalogRoutes.js';
import { serverError, testApp } from '../../testing/testApp.js';

vi.mock('@karmaniverous/jeeves', async (importOriginal) => ({
  ...(await importOriginal<JeevesModule>()),
  getServiceUrl: vi.fn(() => 'http://runner.test'),
}));

type JeevesModule = typeof Jeeves;

const { requireInsider } = vi.hoisted(() => ({ requireInsider: vi.fn() }));
vi.mock('./scopeGuard.js', () => ({ requireInsider }));

const { runnerHandlers, runnerTarget } = await import('./runner.js');

const fetchMock = vi.fn();

/** What the runner answers. */
function runnerAnswers(
  status: number,
  body: string,
  headers: Record<string, string> = { 'content-type': 'application/json' },
) {
  fetchMock.mockResolvedValue(new Response(body, { status, headers }));
}

describe('runnerTarget', () => {
  it('re-encodes path segments and drops credentials from the query', () => {
    expect(
      runnerTarget('jobs/a b/runs', { limit: '5', k: 'secret', key: 'x' }),
    ).toBe('/jobs/a%20b/runs?limit=5');
  });

  it('repeats array values and has no ? without a query', () => {
    expect(runnerTarget('jobs', { tag: ['a', 'b'] })).toBe('/jobs?tag=a&tag=b');
    expect(runnerTarget('status', {})).toBe('/status');
  });
});

describe('runner pass-through', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    runnerAnswers(200, '{"ok":true}');
    vi.stubGlobal('fetch', fetchMock);
    app = testApp();
    await app.register(catalogRoutes(runnerHandlers));
    await app.ready();
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await app.close();
  });

  it.each(['GET', 'DELETE'] as const)(
    'forwards %s with its path and query, no body',
    async (method) => {
      const res = await app.inject({
        method,
        url: '/api/runner/jobs/nightly/runs?limit=5&k=secret',
      });

      expect(fetchMock).toHaveBeenCalledWith(
        'http://runner.test/jobs/nightly/runs?limit=5',
        { method },
      );
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ ok: true });
      expect(requireInsider).toHaveBeenCalledOnce();
    },
  );

  it.each(['POST', 'PATCH', 'PUT'] as const)(
    'forwards %s with its JSON body',
    async (method) => {
      await app.inject({
        method,
        url: '/api/runner/jobs/nightly/enable',
        payload: { reason: 'test' },
      });

      expect(fetchMock).toHaveBeenCalledWith(
        'http://runner.test/jobs/nightly/enable',
        {
          method,
          body: '{"reason":"test"}',
          headers: { 'content-type': 'application/json' },
        },
      );
    },
  );

  it('forwards a missing body as {}', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/runner/jobs/nightly/run',
    });

    expect(res.statusCode).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://runner.test/jobs/nightly/run',
      {
        method: 'POST',
        body: '{}',
        headers: { 'content-type': 'application/json' },
      },
    );
  });

  it('passes a runner error through', async () => {
    runnerAnswers(
      404,
      '{"statusCode":404,"code":"RUNNER_JOB_NOT_FOUND","error":"Not Found","message":"No job nightly"}',
    );
    const res = await app.inject({ url: '/api/runner/jobs/nightly' });

    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({
      statusCode: 404,
      code: 'RUNNER_JOB_NOT_FOUND',
      error: 'Not Found',
      message: 'No job nightly',
    });
    expect(res.headers).not.toHaveProperty('retry-after');
  });

  it('passes a non-JSON runner error through as its message', async () => {
    runnerAnswers(500, 'boom', { 'content-type': 'text/plain' });
    const res = await app.inject({ url: '/api/runner/status' });

    expect(res.statusCode).toBe(500);
    expect(res.json()).toMatchObject({ message: 'boom' });
  });

  it.each([429, 503])(
    'passes a runner %i through with its Retry-After',
    async (status) => {
      runnerAnswers(status, '{"code":"RUNNER_BUSY","message":"busy"}', {
        'content-type': 'application/json',
        'retry-after': '7',
      });
      const res = await app.inject({
        method: 'POST',
        url: '/api/runner/jobs/nightly/run',
      });

      expect(res.statusCode).toBe(status);
      expect(res.headers['retry-after']).toBe('7');
      expect(res.json()).toMatchObject({
        code: 'RUNNER_BUSY',
        message: 'busy',
      });
    },
  );

  it('answers SERVER_RUNNER_UNAVAILABLE when the runner is unreachable', async () => {
    fetchMock.mockRejectedValue(new Error('connect ECONNREFUSED'));
    const res = await app.inject({ url: '/api/runner/jobs' });

    expect(res.json()).toEqual(
      serverError('SERVER_RUNNER_UNAVAILABLE', 'Runner unreachable'),
    );
  });
});
