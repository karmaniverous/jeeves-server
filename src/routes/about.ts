/**
 * About page endpoint
 *
 * TODO: Complete implementation with markdown rendering of about.md
 */

import type { FastifyPluginAsync } from 'fastify';

export const aboutRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/about', async (request, reply) => {
    // TODO: Implement about page rendering from about.md
    reply
      .type('text/html')
      .send(
        '<html><body><h1>About Jeeves Server</h1><p>Implementation pending</p></body></html>',
      );
  });
};
