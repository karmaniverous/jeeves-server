/**
 * OAuth2 API routes (insider auth required).
 *
 * POST /api/oauth/start  - Initiate OAuth2 authorization code flow
 * GET  /api/oauth/status - Check credential existence / expiry
 * GET  /api/oauth/token  - Retrieve valid access token (with lazy refresh)
 *
 * The start route lives in `oauthStart.ts`, the credential routes in
 * `oauthCredentialRoutes.ts`, and credential persistence and refresh in
 * `services/oauthCredentialStore.ts`.
 */

import type { FastifyPluginAsync } from 'fastify';

import { registerOAuthCredentialRoutes } from './oauthCredentialRoutes.js';
import { registerOAuthStartRoute } from './oauthStart.js';

export const oauthApiRoutes: FastifyPluginAsync = (fastify) => {
  registerOAuthStartRoute(fastify);
  registerOAuthCredentialRoutes(fastify);
  return Promise.resolve();
};
