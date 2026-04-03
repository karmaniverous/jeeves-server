/**
 * Runner proxy routes — proxies requests to the local jeeves-runner API.
 *
 * All routes require insider auth. The runner only listens on localhost,
 * so jeeves-server acts as an authenticated gateway.
 */

import { getServiceUrl } from '@karmaniverous/jeeves';
import type { FastifyPluginAsync, FastifyReply } from 'fastify';

function getRunnerUrl(): string {
  return getServiceUrl('runner');
}

/** Proxy a request to the runner and send the response via reply. */
async function proxyToRunner(
  reply: FastifyReply,
  path: string,
  method: 'GET' | 'POST' = 'GET',
): Promise<void> {
  try {
    const res = await fetch(`${getRunnerUrl()}${path}`, { method });
    const text = await res.text();
    void reply
      .code(res.status)
      .header(
        'content-type',
        res.headers.get('content-type') ?? 'application/json',
      )
      .send(text);
  } catch {
    void reply.code(502).send(JSON.stringify({ error: 'Runner unreachable' }));
  }
}

// eslint-disable-next-line @typescript-eslint/require-await
export const runnerRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', async (request, reply) => {
    if (request.accessMode !== 'insider') {
      return reply.code(403).send({ error: 'Insider access required' });
    }
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
        'POST',
      );
    },
  );

  fastify.post<{ Params: { id: string } }>(
    '/api/runner/jobs/:id/disable',
    async (req, reply) => {
      await proxyToRunner(
        reply,
        `/jobs/${encodeURIComponent(req.params.id)}/disable`,
        'POST',
      );
    },
  );

  fastify.get('/api/runner/status', async (_req, reply) => {
    await proxyToRunner(reply, '/status');
  });
};
