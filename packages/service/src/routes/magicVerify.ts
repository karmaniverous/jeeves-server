/**
 * Magic link OTP verification page route — top-level, unauthenticated.
 *
 * GET /auth/magic/verify?enc=<blob>
 *
 * Serves the server-rendered OTP verification page. The client-side
 * JavaScript on that page decrypts the token blob using the Web Crypto API
 * and redirects to /auth/magic/callback on success.
 *
 * @packageDocumentation
 */

import type { FastifyPluginCallback } from 'fastify';

import { renderVerifyPage } from '../auth/verifyPage.js';
import { getConfig } from '../config/index.js';

export const magicVerifyRoute: FastifyPluginCallback = (
  fastify,
  _opts,
  done,
) => {
  fastify.get('/auth/magic/verify', async (_request, reply) => {
    const config = getConfig();
    return reply.type('text/html').send(renderVerifyPage(config.branding));
  });
  done();
};
