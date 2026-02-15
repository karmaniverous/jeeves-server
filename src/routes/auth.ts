/**
 * Google OAuth authentication routes.
 *
 * GET /auth/login    - Redirect to Google consent screen
 * GET /auth/callback - Handle OAuth callback, set session cookie
 * GET /auth/logout   - Clear session cookie
 */

import crypto from 'node:crypto';
import fs from 'node:fs';

import type { FastifyPluginAsync } from 'fastify';

import { buildAuthUrl, exchangeCode, getUserInfo } from '../auth/google.js';
import { COOKIE_NAME, createSessionCookie } from '../auth/session.js';
import { getConfig, resetConfig } from '../config/index.js';
import type { JeevesConfig } from '../config/types.js';

/**
 * Build the redirect URI from the request.
 */
function getRedirectUri(request: {
  protocol: string;
  hostname: string;
}): string {
  return `${request.protocol}://${request.hostname}/auth/callback`;
}

// eslint-disable-next-line @typescript-eslint/require-await
export const authRoute: FastifyPluginAsync = async (fastify) => {
  // GET /auth/login
  fastify.get<{ Querystring: { returnTo?: string } }>(
    '/auth/login',
    async (request, reply) => {
      const config = getConfig();
      const google = config.auth?.google;
      if (!google) {
        return reply.code(500).send({ error: 'Google OAuth not configured' });
      }

      const state = request.query.returnTo
        ? Buffer.from(request.query.returnTo).toString('base64url')
        : undefined;

      const url = buildAuthUrl(google.clientId, getRedirectUri(request), state);
      return reply.redirect(url);
    },
  );

  // GET /auth/callback
  fastify.get<{
    Querystring: { code?: string; error?: string; state?: string };
  }>('/auth/callback', async (request, reply) => {
    const config = getConfig();
    const google = config.auth?.google;
    const sessionSecret = config.auth?.sessionSecret;

    if (!google || !sessionSecret) {
      return reply.code(500).send({ error: 'Google OAuth not configured' });
    }

    if (request.query.error) {
      return reply
        .code(403)
        .send({ error: `OAuth error: ${request.query.error}` });
    }

    const code = request.query.code;
    if (!code) {
      return reply.code(400).send({ error: 'Missing authorization code' });
    }

    // Exchange code for tokens
    const tokens = await exchangeCode(
      google.clientId,
      google.clientSecret,
      getRedirectUri(request),
      code,
    );

    // Get user info
    const userInfo = await getUserInfo(tokens.access_token);
    if (!userInfo.email_verified) {
      return reply.code(403).send({ error: 'Email not verified' });
    }

    const email = userInfo.email.toLowerCase();

    // Check if user is a configured insider
    const insider = config.resolvedInsiders.find(
      (i) => i.email.toLowerCase() === email,
    );
    if (!insider) {
      return reply.code(403).send({
        error: 'Access denied. Your email is not authorized.',
      });
    }

    // Auto-generate insider key on first login if missing
    if (!insider.seed) {
      const newSeed = crypto.randomBytes(32).toString('hex');
      insider.seed = newSeed;

      // Persist to jeeves.config.json
      const fullConfig = JSON.parse(
        fs.readFileSync(config.configPath, 'utf8'),
      ) as JeevesConfig;
      const insiderEntry = fullConfig.insiders?.[insider.email];
      if (insiderEntry) {
        insiderEntry.key = newSeed;
        fs.writeFileSync(
          config.configPath,
          JSON.stringify(fullConfig, null, 2),
          'utf8',
        );
        resetConfig();
      }
    }

    // Set session cookie
    const cookieValue = createSessionCookie(email, sessionSecret);
    void reply.setCookie(COOKIE_NAME, cookieValue, {
      path: '/',
      httpOnly: true,
      secure: request.protocol === 'https',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60, // 30 days in seconds
    });

    // Redirect to returnTo or root
    const returnTo = request.query.state
      ? Buffer.from(request.query.state, 'base64url').toString()
      : '/path';
    return reply.redirect(returnTo);
  });

  // GET /auth/logout

  fastify.get('/auth/logout', async (_request, reply) => {
    void reply.clearCookie(COOKIE_NAME, { path: '/' });
    return reply.redirect('/auth/login');
  });
};
