/**
 * Legacy /path redirect — sends all /path/* requests to /browse/*
 */

import type { FastifyPluginAsync } from 'fastify';

// eslint-disable-next-line @typescript-eslint/require-await
export const pathRoute: FastifyPluginAsync = async (fastify) => {
  // Redirect /path (root) to /browse
  fastify.get('/path', async (_request, reply) => {
    return reply.redirect('/browse');
  });

  // Redirect /path/* to /browse/*
  fastify.get<{ Params: { '*': string } }>(
    '/path/*',
    async (request, reply) => {
      const reqPath = request.params['*'];
      const url = new URL(request.url, 'http://127.0.0.1');
      const query = url.search;
      return reply.redirect(`/browse/${reqPath}${query}`);
    },
  );
};
