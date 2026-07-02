/**
 * Magic link callback route — top-level, unauthenticated.
 *
 * GET /auth/magic/callback?token=<signed-token>
 *
 * Verifies the self-validating signed token (HMAC-SHA256), issues a session
 * cookie (identical to Google OAuth), and redirects to returnTo.
 *
 * @packageDocumentation
 */

import crypto from 'node:crypto';

import type { FastifyPluginCallback } from 'fastify';

import { renderErrorPage } from '../auth/errorPage.js';
import { sanitizeReturnTo } from '../auth/resolve.js';
import { setSessionCookie } from '../auth/session.js';
import { getConfig, resetConfig } from '../config/index.js';
import { writeInsiderSeedToConfig } from '../util/configPersist.js';
import { verifyToken } from '../util/magicToken.js';

export const magicCallbackRoute: FastifyPluginCallback = (
  fastify,
  _opts,
  done,
) => {
  fastify.get<{ Querystring: { token?: string } }>(
    '/auth/magic/callback',
    async (request, reply) => {
      const { token } = request.query;

      if (!token) {
        return reply
          .type('text/html')
          .code(400)
          .send(renderErrorPage('Login Link Error', 'No token provided.'));
      }

      const config = getConfig();
      const sessionSecret = config.sessionSecret;

      if (!sessionSecret) {
        return reply
          .type('text/html')
          .code(500)
          .send(renderErrorPage('Error', 'Server configuration error.'));
      }

      // Verify HMAC signature, parse payload, check expiry
      const payload = verifyToken(token, sessionSecret);
      if (!payload) {
        return reply
          .type('text/html')
          .code(400)
          .send(
            renderErrorPage(
              'Login Link Error',
              'This login link has expired or is invalid. Please request a new one.',
            ),
          );
      }

      // Look up the insider
      const insider = config.resolvedInsiders.find(
        (i) => i.email.toLowerCase() === payload.email.toLowerCase(),
      );

      if (!insider) {
        return reply
          .type('text/html')
          .code(403)
          .send(
            renderErrorPage(
              'Access Denied',
              'Your email is no longer authorized for access.',
            ),
          );
      }

      // Auto-generate insider seed on first login if missing (same as Google OAuth)
      if (!insider.seed) {
        const newSeed = crypto.randomBytes(32).toString('hex');
        const timestamp = new Date().toISOString();
        insider.seed = newSeed;

        await writeInsiderSeedToConfig(insider.email, newSeed, timestamp);
        resetConfig();
      }

      // Set session cookie (identical shape to Google OAuth sessions)
      setSessionCookie(reply, request, payload.email, sessionSecret);

      // Redirect to the originally requested path, or /browse as fallback.
      const returnTo = sanitizeReturnTo(payload.returnTo ?? '/browse');
      return reply.redirect(returnTo);
    },
  );
  done();
};
