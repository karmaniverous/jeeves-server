/**
 * Google OAuth authentication routes.
 *
 * GET /auth/login    - Redirect to Google consent screen
 * GET /auth/callback - Handle OAuth callback, set session cookie
 * GET /auth/logout   - Clear session cookie
 */

import crypto from 'node:crypto';

import type { FastifyPluginCallback } from 'fastify';

import { buildAuthUrl, exchangeCode, getUserInfo } from '../auth/google.js';
import { sanitizeReturnTo } from '../auth/resolve.js';
import { COOKIE_NAME, setSessionCookie } from '../auth/session.js';
import { getConfig, resetConfig } from '../config/index.js';
import { writeInsiderSeedToConfig } from '../util/configPersist.js';
import {
  getPublicOrigin,
  type OriginRequest,
  sendPublicOriginConfigError,
} from '../util/publicOrigin.js';

/**
 * Build the Google redirect URI on the configured public origin, or null
 * when none can be determined (never from untrusted request headers).
 */
function getRedirectUri(request: OriginRequest): string | null {
  const origin = getPublicOrigin(getConfig(), request);
  return origin ? `${origin}/auth/callback` : null;
}

export const authRoute: FastifyPluginCallback = (fastify, _opts, done) => {
  // GET /auth/login
  fastify.get<{ Querystring: { returnTo?: string } }>(
    '/auth/login',
    async (request, reply) => {
      const config = getConfig();
      const google = config.googleAuth;
      if (!google) {
        return reply.code(500).send({ error: 'Google OAuth not configured' });
      }

      const state = request.query.returnTo
        ? Buffer.from(request.query.returnTo).toString('base64url')
        : undefined;

      const redirectUri = getRedirectUri(request);
      if (!redirectUri) return sendPublicOriginConfigError(reply);

      const url = buildAuthUrl(google.clientId, redirectUri, state);
      return reply.redirect(url);
    },
  );

  // GET /auth/callback
  fastify.get<{
    Querystring: { code?: string; error?: string; state?: string };
  }>('/auth/callback', async (request, reply) => {
    const config = getConfig();
    const google = config.googleAuth;
    const sessionSecret = config.sessionSecret;

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

    const redirectUri = getRedirectUri(request);
    if (!redirectUri) return sendPublicOriginConfigError(reply);

    // Exchange code for tokens
    const tokens = await exchangeCode(
      google.clientId,
      google.clientSecret,
      redirectUri,
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
      const timestamp = new Date().toISOString();
      insider.seed = newSeed;

      await writeInsiderSeedToConfig(insider.email, newSeed, timestamp);
      resetConfig(); // Reload to pick up new state
    }

    // Set session cookie
    setSessionCookie(reply, request, email, sessionSecret, userInfo.picture);

    // Redirect to returnTo or root (with open-redirect protection)
    const rawReturnTo = request.query.state
      ? Buffer.from(request.query.state, 'base64url').toString()
      : '/browse';
    const returnTo = sanitizeReturnTo(rawReturnTo);
    return reply.redirect(returnTo);
  });

  // GET /auth/logout

  fastify.get('/auth/logout', async (_request, reply) => {
    void reply.clearCookie(COOKIE_NAME, { path: '/' });
    return reply.redirect('/');
  });
  done();
};
