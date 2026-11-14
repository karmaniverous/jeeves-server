/**
 * Runner proxy routes — proxies requests to the local jeeves-runner API.
 *
 * All routes require insider auth. The runner only listens on localhost,
 * so jeeves-server acts as an authenticated gateway.
 */

import { getServiceUrl } from '@karmaniverous/jeeves';
import type { FastifyPluginCallback, FastifyReply } from 'fastify';

import { RunnerUnavailable } from '../../api/errors.js';
import { requireInsider } from './scopeGuard.js';

function getRunnerUrl(): string {
  return getServiceUrl('runner');
}

/**
 * Proxy a request to the runner and send its response via reply, unchanged:
 * status, body, `content-type` and `Retry-After` (runner errors pass
 * through as the runner sent them, #315).
 *
 * @throws `SERVER_RUNNER_UNAVAILABLE` (503) when the runner can't be
 *   reached (the transport error is its `cause`, logged, never sent).
 */
async function proxyToRunner(
  reply: FastifyReply,
  path: string,
  method: 'GET' | 'POST' | 'PATCH' = 'GET',
): Promise<void> {
  let res: Response;
  let text: string;
  try {
    res = await fetch(`${getRunnerUrl()}${path}`, { method });
    text = await res.text();
  } catch (cause) {
    throw Object.assign(new RunnerUnavailable(), { cause });
  }
  const retryAfter = res.headers.get('retry-after');
  if (retryAfter !== null) void reply.header('retry-after', retryAfter);
  void reply
    .code(res.status)
    .header(
      'content-type',
      res.headers.get('content-type') ?? 'application/json',
    )
    .send(text);
}

export const runnerRoutes: FastifyPluginCallback = (fastify, _opts, done) => {
  fastify.addHook('preHandler', (request, _reply, hookDone) => {
    requireInsider(request);
    hookDone();
  });

  fastify.get('/api/runner/jobs', async (_req, reply) => {
    await proxyToRunner(reply, '/jobs');
  });

  fastify.get<{ Params: { id: string } }>(
    '/api/runner/jobs/:id',
    async (req, reply) => {
      await proxyToRunner(reply, `/jobs/${encodeURIComponent(req.params.id)}`);
    },
  );

  fastify.get<{ Params: { id: string }; Querystring: { limit?: string } }>(
    '/api/runner/jobs/:id/runs',
    async (req, reply) => {
      const limit = req.query.limit ?? '20';
      const id = encodeURIComponent(req.params.id);
      await proxyToRunner(reply, `/jobs/${id}/runs?limit=${limit}`);
    },
  );

  fastify.post<{ Params: { id: string } }>(
    '/api/runner/jobs/:id/run',
    async (req, reply) => {
      await proxyToRunner(
        reply,
        `/jobs/${encodeURIComponent(req.params.id)}/run`,
        'POST',
      );
    },
  );

  fastify.post<{ Params: { id: string } }>(
    '/api/runner/jobs/:id/enable',
    async (req, reply) => {
      await proxyToRunner(
        reply,
        `/jobs/${encodeURIComponent(req.params.id)}/enable`,
        'PATCH',
      );
    },
  );

  fastify.post<{ Params: { id: string } }>(
    '/api/runner/jobs/:id/disable',
    async (req, reply) => {
      await proxyToRunner(
        reply,
        `/jobs/${encodeURIComponent(req.params.id)}/disable`,
        'PATCH',
      );
    },
  );

  fastify.get('/api/runner/status', async (_req, reply) => {
    await proxyToRunner(reply, '/status');
  });
  done();
};
