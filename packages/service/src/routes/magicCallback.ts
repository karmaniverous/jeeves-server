/**
 * Magic link callback route — top-level, unauthenticated.
 *
 * GET /auth/magic/callback?token=<token>
 *
 * Validates the token, issues a session cookie (identical to Google OAuth),
 * and redirects to /browse.
 *
 * @packageDocumentation
 */

import crypto from 'node:crypto';

import type { FastifyPluginAsync } from 'fastify';

import { renderErrorPage } from '../auth/errorPage.js';
import { sanitizeReturnTo } from '../auth/resolve.js';
import { setSessionCookie } from '../auth/session.js';
import { getConfig, resetConfig } from '../config/index.js';
import { consumeMagicToken } from '../services/magicLinkState.js';
import { writeInsiderSeedToConfig } from '../util/configPersist.js';

// eslint-disable-next-line @typescript-eslint/require-await
export const magicCallbackRoute: FastifyPluginAsync = async (fastify) => {
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

      const pending = consumeMagicToken(token);
      if (!pending) {
        return reply
          .type('text/html')
          .code(400)
          .send(
            renderErrorPage(
              'Login Link Error',
              'This login link has expired or has already been used. Please request a new one.',
            ),
          );
      }

      const config = getConfig();
      const sessionSecret = config.sessionSecret;

      if (!sessionSecret) {
        return reply
          .type('text/html')
          .code(500)
          .send(renderErrorPage('Error', 'Server configuration error.'));
      }

      // Look up the insider
      const insider = config.resolvedInsiders.find(
        (i) => i.email.toLowerCase() === pending.email.toLowerCase(),
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
      setSessionCookie(reply, request, pending.email, sessionSecret);

      // Redirect to the originally requested path, or /browse as fallback.
      const returnTo = sanitizeReturnTo(pending.returnTo || '/browse');
      return reply.redirect(returnTo);
    },
  );
};
