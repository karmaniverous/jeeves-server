/**
 * Legacy /path redirect — sends all /path/* requests to /browse/*
 */

import type { FastifyPluginCallback } from 'fastify';

export const pathRoute: FastifyPluginCallback = (fastify, _opts, done) => {
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
  done();
};
