/**
 * Google sign-in to the portal (#270: distinct from the generic OAuth2 provider flow on `/oauth/callback`; the paths stay, Decision 17).
 *
 * GET /auth/login    - Redirect to Google's consent screen
 *                      (`prompt=select_account` to switch account)
 * GET /auth/callback - Handle Google's callback: a session for an insider,
 *                      the rejection page (or 403 `SERVER_SIGN_IN_REJECTED`
 *                      for a JSON client) for anyone else (#304)
 * GET /auth/logout   - Clear the session cookie
 *
 * @packageDocumentation
 */

import crypto from 'node:crypto';

import type {
  FastifyPluginCallback,
  FastifyReply,
  FastifyRequest,
} from 'fastify';

import { SignInRejected } from '../api/errors.js';
import {
  buildGoogleSignInUrl,
  exchangeGoogleSignInCode,
  getGoogleSignInUser,
  type GoogleSignInPrompt,
} from '../auth/googleSignIn.js';
import { sanitizeReturnTo } from '../auth/resolve.js';
import { COOKIE_NAME, setSessionCookie } from '../auth/session.js';
import {
  renderSignInRejectedPage,
  type SignInRejectionReason,
} from '../auth/signInRejectedPage.js';
import { getConfig, resetConfig } from '../config/index.js';
import { writeInsiderSeedToConfig } from '../util/configPersist.js';
import { prefersJson } from '../util/prefersJson.js';
import {
  type OriginRequest,
  sendPublicOriginConfigError,
} from '../util/publicOrigin.js';
import { googleSignInRedirectUri } from '../util/redirectUris.js';

/** The Google sign-in redirect URI, or null without a public origin. */
const getRedirectUri = (request: OriginRequest): string | null =>
  googleSignInRedirectUri(getConfig(), request);

/** The validated `returnTo` a callback's `state` carries. */
const returnToFromState = (state: string | undefined): string =>
  sanitizeReturnTo(
    state ? Buffer.from(state, 'base64url').toString() : '/browse',
  );

/** The caller-facing message for each rejection reason. */
const REJECTION_MESSAGES: Record<SignInRejectionReason, string> = {
  not_insider: "This Google account is not on this server's access list",
  unverified: "This Google account's email address is not verified",
};

/**
 * Refuse a Google sign-in (#304): log it at `warn`, then answer a JSON
 * client with 403 `SERVER_SIGN_IN_REJECTED` and anyone else with the
 * branded rejection page.
 */
function rejectGoogleSignIn(
  request: FastifyRequest,
  reply: FastifyReply,
  rejection: { email: string; reason: SignInRejectionReason; state?: string },
): FastifyReply {
  const { email, reason } = rejection;
  request.log.warn({ email, reason }, 'Google sign-in rejected');
  if (prefersJson(request.headers.accept)) {
    throw new SignInRejected(REJECTION_MESSAGES[reason]);
  }
  const config = getConfig();
  return reply
    .code(403)
    .type('text/html; charset=utf-8')
    .send(
      renderSignInRejectedPage({
        email,
        reason,
        returnTo: returnToFromState(rejection.state),
        authModes: config.authModes,
        branding: config.branding,
        accessContact: config.accessContact,
      }),
    );
}

export const googleSignInRoute: FastifyPluginCallback = (
  fastify,
  _opts,
  done,
) => {
  fastify.get<{ Querystring: { returnTo?: string; prompt?: string } }>(
    '/auth/login',
    async (request, reply) => {
      const google = getConfig().googleAuth;
      if (!google) {
        return reply.code(500).send({ error: 'Google OAuth not configured' });
      }

      const state = request.query.returnTo
        ? Buffer.from(request.query.returnTo).toString('base64url')
        : undefined;
      const prompt: GoogleSignInPrompt =
        request.query.prompt === 'select_account'
          ? 'select_account'
          : 'consent';

      const redirectUri = getRedirectUri(request);
      if (!redirectUri) return sendPublicOriginConfigError(reply);

      return reply.redirect(
        buildGoogleSignInUrl(google.clientId, redirectUri, state, prompt),
      );
    },
  );

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

    const tokens = await exchangeGoogleSignInCode(
      google.clientId,
      google.clientSecret,
      redirectUri,
      code,
    );
    const user = await getGoogleSignInUser(tokens.access_token);
    const email = user.email.toLowerCase();
    const { state } = request.query;

    if (!user.email_verified) {
      return rejectGoogleSignIn(request, reply, {
        email,
        reason: 'unverified',
        state,
      });
    }

    const insider = config.resolvedInsiders.find(
      (i) => i.email.toLowerCase() === email,
    );
    if (!insider) {
      return rejectGoogleSignIn(request, reply, {
        email,
        reason: 'not_insider',
        state,
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

    setSessionCookie(reply, request, email, sessionSecret, user.picture);

    // Redirect to returnTo or root (with open-redirect protection)
    return reply.redirect(returnToFromState(state));
  });

  fastify.get('/auth/logout', async (_request, reply) => {
    void reply.clearCookie(COOKIE_NAME, { path: '/' });
    return reply.redirect('/');
  });
  done();
};
