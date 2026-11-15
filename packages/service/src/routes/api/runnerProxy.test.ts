/**
 * The runner proxy handlers (Decision 28): each entry calls its one runner route (fixed method and path, the job ID encoded as one segment, only the runs `limit` forwarded, never a credential or a body); the runner's status, body, content type and Retry-After come back (#315).
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

const { runnerHandlers } = await import('./runner.js');

const fetchMock = vi.fn();

/** What the runner answers. */
function runnerAnswers(
  status: number,
  body: string,
  headers: Record<string, string> = { 'content-type': 'application/json' },
) {
  fetchMock.mockResolvedValue(new Response(body, { status, headers }));
}

describe('runner proxy', () => {
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

  it.each([
    ['GET', '/api/runner/jobs?k=secret', 'GET', '/jobs'],
    ['GET', '/api/runner/jobs/a%20b?key=x', 'GET', '/jobs/a%20b'],
    [
      'GET',
      '/api/runner/jobs/a%2Fb/runs?limit=5&k=secret&tag=x',
      'GET',
      '/jobs/a%2Fb/runs?limit=5',
    ],
    [
      'GET',
      '/api/runner/jobs/nightly/runs',
      'GET',
      '/jobs/nightly/runs?limit=20',
    ],
    ['POST', '/api/runner/jobs/nightly/run', 'POST', '/jobs/nightly/run'],
    [
      'PATCH',
      '/api/runner/jobs/nightly/enable',
      'PATCH',
      '/jobs/nightly/enable',
    ],
    [
      'PATCH',
      '/api/runner/jobs/nightly/disable',
      'PATCH',
      '/jobs/nightly/disable',
    ],
    ['GET', '/api/runner/status', 'GET', '/status'],
  ] as const)(
    '%s %s calls runner %s %s, with no credential or body',
    async (method, url, runnerMethod, runnerPath) => {
      const res = await app.inject({
        method,
        url,
        ...(method === 'GET' ? {} : { payload: { reason: 'x' } }),
      });

      expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
        `http://runner.test${runnerPath}`,
        { method: runnerMethod },
      );
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ ok: true });
      expect(requireInsider).toHaveBeenCalledOnce();
    },
  );

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
