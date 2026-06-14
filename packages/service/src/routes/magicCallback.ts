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

import { COOKIE_NAME, createSessionCookie } from '../auth/session.js';
import { getConfig, resetConfig } from '../config/index.js';
import { consumeMagicToken } from '../services/magicLinkState.js';
import { writeInsiderSeedToConfig } from '../util/configPersist.js';

/**
 * Render an inline HTML error page for invalid/expired magic links.
 */
function renderErrorPage(message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Login Link Error</title>
<style>
  body {
    font-family: system-ui, -apple-system, sans-serif;
    max-width: 480px;
    margin: 80px auto;
    padding: 0 20px;
    text-align: center;
    color: #1a1a1a;
    background: #fff;
  }
  @media (prefers-color-scheme: dark) {
    body { color: #e0e0e0; background: #1a1a1a; }
  }
  h1 { font-size: 1.5rem; font-weight: 600; margin-bottom: 0.5rem; }
  p { font-size: 0.95rem; line-height: 1.5; color: #666; }
  @media (prefers-color-scheme: dark) { p { color: #999; } }
  a { color: #4285f4; text-decoration: none; }
  a:hover { text-decoration: underline; }
</style>
</head>
<body>
<h1>Login link expired or invalid</h1>
<p>${message}</p>
<p><a href="/">Return to sign in</a></p>
</body>
</html>`;
}

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
          .send(renderErrorPage('No token provided.'));
      }

      const pending = consumeMagicToken(token);
      if (!pending) {
        return reply
          .type('text/html')
          .code(400)
          .send(
            renderErrorPage(
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
          .send(renderErrorPage('Server configuration error.'));
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
            renderErrorPage('Your email is no longer authorized for access.'),
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
      const cookieValue = createSessionCookie(pending.email, sessionSecret);
      void reply.setCookie(COOKIE_NAME, cookieValue, {
        path: '/',
        httpOnly: true,
        secure:
          (request.headers['x-forwarded-proto'] as string | undefined) ===
          'https',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60, // 30 days in seconds
      });

      return reply.redirect('/browse');
    },
  );
};
