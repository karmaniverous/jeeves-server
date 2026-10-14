/**
 * OAuth2 start route (insider auth required).
 *
 * POST /api/oauth/start - Initiate OAuth2 authorization code flow
 *
 * @packageDocumentation
 */

import crypto from 'node:crypto';

import type { FastifyInstance } from 'fastify';

import { getConfig } from '../../config/index.js';
import { storePending } from '../../services/oauthState.js';
import {
  getPublicOrigin,
  sendPublicOriginConfigError,
  trimTrailingSlashes,
} from '../../util/publicOrigin.js';
import { rejectInvalidCredentialNames } from './oauthGuards.js';

interface StartBody {
  provider: string;
  account: string;
  authUrl?: string;
  tokenUrl?: string;
  clientId: string;
  clientSecret: string;
  scopes?: string[];
  pkce?: boolean;
  origin?: string;
}

/**
 * Why an explicit `origin` is unacceptable for a redirect URI, or null when
 * it is fine: https (or http on localhost), no credentials, no path, no
 * query, no fragment. A bare `@`, `?` or `#` counts too: the URL parser
 * drops it, but it would still be pasted into the redirect URI.
 */
function originParamError(origin: string): string | null {
  let originUrl: URL;
  try {
    originUrl = new URL(origin);
  } catch {
    return 'origin must be a valid URL';
  }

  const scheme = originUrl.protocol.replace(/:$/, '');
  if (
    scheme !== 'https' &&
    !(scheme === 'http' && originUrl.hostname === 'localhost')
  ) {
    return 'origin scheme must be https (or http for localhost)';
  }
  if (originUrl.username || originUrl.password || origin.includes('@')) {
    return 'origin must not contain credentials';
  }
  if (originUrl.hash || origin.includes('#')) {
    return 'origin must not have a fragment';
  }
  if (originUrl.pathname !== '/') return 'origin must not have a pathname';
  if (originUrl.search || origin.includes('?')) {
    return 'origin must not have query parameters';
  }
  return null;
}

/** Register `POST /api/oauth/start`. */
export function registerOAuthStartRoute(fastify: FastifyInstance): void {
  fastify.post<{ Body: StartBody }>(
    '/api/oauth/start',
    async (request, reply) => {
      const config = getConfig();
      if (!config.oauth) {
        return reply.code(501).send({ error: 'OAuth not configured' });
      }

      if (request.accessMode !== 'insider') {
        return reply.code(401).send({ error: 'Insider auth required' });
      }

      const { provider, account, clientId, clientSecret } = request.body;

      if (!provider || !account || !clientId || !clientSecret) {
        return reply.code(400).send({
          error: 'provider, account, clientId, and clientSecret are required',
        });
      }

      if (rejectInvalidCredentialNames(reply, provider, account)) return reply;

      // Merge named provider defaults (request fields override)
      const namedProvider = config.oauth.providers[provider] as
        (typeof config.oauth.providers)[string] | undefined;
      const body = request.body as Partial<StartBody>;
      const authUrl = body.authUrl ?? namedProvider?.authUrl;
      const tokenUrl = body.tokenUrl ?? namedProvider?.tokenUrl;
      const pkce = body.pkce ?? namedProvider?.pkce ?? false;
      const scopes = body.scopes ?? namedProvider?.defaultScopes ?? [];

      if (!authUrl || !tokenUrl) {
        return reply.code(400).send({
          error:
            'authUrl and tokenUrl are required (either in request body or via named provider config)',
        });
      }

      // Generate state
      const state = crypto.randomBytes(32).toString('hex');

      // PKCE
      let codeVerifier: string | undefined;
      let codeChallenge: string | undefined;
      if (pkce) {
        codeVerifier = crypto.randomBytes(32).toString('base64url');
        codeChallenge = crypto
          .createHash('sha256')
          .update(codeVerifier)
          .digest('base64url');
      }

      // Validate origin param if provided
      if (request.body.origin !== undefined) {
        const error = originParamError(request.body.origin);
        if (error) return reply.code(400).send({ error });
      }

      // Derive redirect_uri: the caller's validated origin, else the
      // configured public origin (never untrusted request headers).
      const origin =
        request.body.origin ?? getPublicOrigin(getConfig(), request);

      if (!origin) return sendPublicOriginConfigError(reply);

      const redirectUri = `${trimTrailingSlashes(origin)}/oauth/callback`;

      // Store pending
      storePending(state, {
        codeVerifier,
        tokenUrl,
        clientId,
        clientSecret,
        redirectUri,
        provider,
        account,
      });

      // Build auth URL
      const authUrlObj = new URL(authUrl);
      authUrlObj.searchParams.set('response_type', 'code');
      authUrlObj.searchParams.set('client_id', clientId);
      authUrlObj.searchParams.set('redirect_uri', redirectUri);
      if (scopes.length > 0) {
        authUrlObj.searchParams.set('scope', scopes.join(' '));
      }
      authUrlObj.searchParams.set('state', state);
      if (pkce && codeChallenge) {
        authUrlObj.searchParams.set('code_challenge', codeChallenge);
        authUrlObj.searchParams.set('code_challenge_method', 'S256');
      }

      return reply.send({ authUrl: authUrlObj.toString(), state });
    },
  );
}
