/**
 * OAuth2 start route (insider auth required).
 *
 * POST /api/oauth/start - Initiate OAuth2 authorization code flow
 *
 * @packageDocumentation
 */

import crypto from 'node:crypto';

import { InvalidRequest } from '../../api/errors.js';
import { type HandlersFor, ok } from '../../api/handlerTypes.js';
import { getConfig } from '../../config/index.js';
import { storePending } from '../../services/oauthState.js';
import {
  getPublicOrigin,
  publicOriginConfigError,
  trimTrailingSlashes,
} from '../../util/publicOrigin.js';
import { OAUTH_CALLBACK_PATH } from '../../util/redirectUris.js';
import {
  requireOAuthInsider,
  requireValidCredentialNames,
} from './oauthGuards.js';

/**
 * Why an explicit `origin` is unacceptable for a redirect URI, or null when
 * it is fine: https (or http on localhost), no credentials, no path, no
 * query, no fragment. A bare `@`, `?` or `#` counts too: the URL parser
 * drops it, but it would still be pasted into the redirect URI. Any `\` is
 * refused before parsing: the parser reads it as `/` in http(s) URLs, so
 * `https://host\evil` would otherwise pass with a path the check never saw.
 */
function originParamError(origin: string): string | null {
  if (origin.includes('\\')) return 'origin must be a valid URL';
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

/** `oauthStart`: begin an OAuth2 authorization code flow. */
export const oauthStartHandlers: HandlersFor<'oauthStart'> = {
  oauthStart: ({ body }, request) => {
    const oauth = requireOAuthInsider(request);

    const { provider, account, clientId, clientSecret } = body;

    if (!provider || !account || !clientId || !clientSecret)
      throw new InvalidRequest(
        'provider, account, clientId, and clientSecret are required',
      );

    requireValidCredentialNames(provider, account);

    // Merge named provider defaults (request fields override)
    const namedProvider = oauth.providers[provider] as
      (typeof oauth.providers)[string] | undefined;
    const authUrl = body.authUrl ?? namedProvider?.authUrl;
    const tokenUrl = body.tokenUrl ?? namedProvider?.tokenUrl;
    const pkce = body.pkce ?? namedProvider?.pkce ?? false;
    const scopes = body.scopes ?? namedProvider?.defaultScopes ?? [];

    if (!authUrl || !tokenUrl)
      throw new InvalidRequest(
        'authUrl and tokenUrl are required (either in request body or via named provider config)',
      );

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
    if (body.origin !== undefined) {
      const error = originParamError(body.origin);
      if (error) throw new InvalidRequest(error);
    }

    // Derive redirect_uri: the caller's validated origin, else the
    // configured public origin (never untrusted request headers).
    const origin = body.origin ?? getPublicOrigin(getConfig(), request);

    if (!origin) throw publicOriginConfigError();

    const redirectUri = `${trimTrailingSlashes(origin)}${OAUTH_CALLBACK_PATH}`;

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

    return Promise.resolve(ok({ authUrl: authUrlObj.toString(), state }));
  },
};
