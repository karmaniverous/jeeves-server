/**
 * The two sign-in callback URIs (#270, Decision 17): Google sign-in to the portal (`/auth/callback`) and the generic OAuth2 provider flow (`/oauth/callback`), on the public origin. `/status` shows them and the Google sign-in route sends the first one.
 *
 * @packageDocumentation
 */

import type { RuntimeConfig } from '../config/types.js';
import { getPublicOrigin, type OriginRequest } from './publicOrigin.js';

/** Path of the Google sign-in callback (portal sign-in). */
export const GOOGLE_CALLBACK_PATH = '/auth/callback';

/** Path of the generic OAuth2 provider callback. */
export const OAUTH_CALLBACK_PATH = '/oauth/callback';

/** Config fields the redirect URIs depend on. */
type RedirectConfig = Pick<
  RuntimeConfig,
  'publicUrl' | 'trustProxyHeaders' | 'authModes' | 'oauth'
>;

/**
 * The Google sign-in redirect URI (`{public origin}/auth/callback`), or
 * null when no public origin can be determined (never from untrusted
 * request headers).
 *
 * @param config - The runtime config.
 * @param request - The request (for trusted proxy headers).
 * @returns The URI, or null.
 */
export function googleSignInRedirectUri(
  config: RedirectConfig,
  request: OriginRequest,
): string | null {
  const origin = getPublicOrigin(config, request);
  return origin ? `${origin}${GOOGLE_CALLBACK_PATH}` : null;
}

/**
 * The redirect URIs `/status` reports in `health.auth`: `googleRedirectUri`
 * when `google` is a sign-in mode and a public origin resolves,
 * `oauthRedirectUri` when OAuth providers are configured and a public
 * origin resolves. Both are public facts (browsers are sent to them).
 *
 * @param config - The runtime config.
 * @param request - The request (for trusted proxy headers).
 * @returns The fields to add; empty when neither applies.
 */
export function statusRedirectUris(
  config: RedirectConfig,
  request: OriginRequest,
): { googleRedirectUri?: string; oauthRedirectUri?: string } {
  const origin = getPublicOrigin(config, request);
  if (!origin) return {};
  const providers = Object.keys(config.oauth?.providers ?? {});
  return {
    ...(config.authModes.includes('google')
      ? { googleRedirectUri: `${origin}${GOOGLE_CALLBACK_PATH}` }
      : {}),
    ...(providers.length > 0
      ? { oauthRedirectUri: `${origin}${OAUTH_CALLBACK_PATH}` }
      : {}),
  };
}
