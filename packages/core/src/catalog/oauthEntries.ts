/**
 * The OAuth entries of the server catalog: start an authorization code flow, check stored credentials and get an access token. Pure.
 *
 * @packageDocumentation
 */

import { z } from 'zod';

import { INSIDER_ONLY, route } from './route.js';

/** `oauthStart` body. */
export const oauthStartBodySchema = z.object({
  /** Provider name (a configured provider supplies the defaults). */
  provider: z.string().describe('Provider name.'),
  /** Account name the credential is stored under. */
  account: z.string().describe('Account name.'),
  /** Authorization endpoint (default: the configured provider's). */
  authUrl: z.string().optional().describe('Authorization endpoint URL.'),
  /** Token endpoint (default: the configured provider's). */
  tokenUrl: z.string().optional().describe('Token endpoint URL.'),
  /** Client id. */
  clientId: z.string().describe('OAuth client id.'),
  /** Client secret. */
  clientSecret: z.string().describe('OAuth client secret.'),
  /** Scopes (default: the configured provider's). */
  scopes: z.array(z.string()).optional().describe('Scopes to request.'),
  /** Use PKCE (default: the configured provider's, else false). */
  pkce: z.boolean().optional().describe('Use PKCE.'),
  /** Origin of the redirect URI (default: the configured public URL). */
  origin: z
    .string()
    .optional()
    .describe('Origin for the redirect URI (default: the public URL).'),
});

/** `oauthStart` response. */
export const oauthStartResponseSchema = z.object({
  /** URL to open in a browser. */
  authUrl: z.string(),
  /** The flow's state value. */
  state: z.string(),
});

/** `oauthStatus` and `oauthToken` query. */
export const oauthCredentialQuerySchema = z.object({
  /** Provider name. */
  provider: z.string().describe('Provider name.'),
  /** Account name. */
  account: z.string().describe('Account name.'),
});

/** `oauthStatus` response. */
export const oauthStatusResponseSchema = z.object({
  /** A credential file exists. */
  exists: z.boolean(),
  /** It has expired (or can't be read). */
  expired: z.boolean(),
  /** Provider asked for. */
  provider: z.string(),
  /** Account asked for. */
  account: z.string(),
});

/** `oauthToken` response. */
export const oauthTokenResponseSchema = z.object({
  /** Access token. */
  access_token: z.string(),
  /** Token type (normally `Bearer`). */
  token_type: z.string(),
  /** Seconds until expiry, or null when unknown. */
  expires_in_seconds: z.number().nullable(),
});

/** The OAuth entries. */
export const OAUTH_ENTRIES = [
  {
    ...route('oauthStart', 'POST', '/api/oauth/start'),
    body: oauthStartBodySchema,
    response: oauthStartResponseSchema,
    auth: INSIDER_ONLY,
    kind: 'write',
  },
  {
    ...route('oauthStatus', 'GET', '/api/oauth/status'),
    query: oauthCredentialQuerySchema,
    response: oauthStatusResponseSchema,
    auth: INSIDER_ONLY,
    kind: 'read',
  },
  {
    ...route('oauthToken', 'GET', '/api/oauth/token'),
    query: oauthCredentialQuerySchema,
    response: oauthTokenResponseSchema,
    auth: INSIDER_ONLY,
    kind: 'read',
  },
] as const;
