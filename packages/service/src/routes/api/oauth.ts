/**
 * OAuth2 API routes (insider auth required).
 *
 * POST /api/oauth/start  — Initiate OAuth2 authorization code flow
 * GET  /api/oauth/status — Check credential existence / expiry
 * GET  /api/oauth/token  — Retrieve valid access token (with lazy refresh)
 */

import crypto from 'node:crypto';
import fsp from 'node:fs/promises';

import type { FastifyPluginAsync } from 'fastify';

import { getConfig } from '../../config/index.js';
import { credentialPath, storePending } from '../../services/oauthState.js';
import { withFileLock } from '../../util/fileMutex.js';

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

interface StatusQuery {
  provider: string;
  account: string;
}

interface TokenQuery {
  provider: string;
  account: string;
}

interface CredentialFile {
  provider: string;
  account: string;
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type: string;
  scope?: string;
  obtained_at: string;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
}

function isExpired(cred: CredentialFile): boolean {
  if (cred.expires_in === undefined) return false;
  const obtainedMs = new Date(cred.obtained_at).getTime();
  return Date.now() > obtainedMs + cred.expires_in * 1000;
}

function remainingSeconds(cred: CredentialFile): number | null {
  if (cred.expires_in === undefined) return null;
  const obtainedMs = new Date(cred.obtained_at).getTime();
  const remaining = Math.floor(
    (obtainedMs + cred.expires_in * 1000 - Date.now()) / 1000,
  );
  return Math.max(0, remaining);
}

export const oauthApiRoutes: FastifyPluginAsync = (fastify) => {
  // POST /api/oauth/start
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

      // Merge named provider defaults (request fields override)
      const namedProvider = config.oauth.providers[provider] as
        | (typeof config.oauth.providers)[string]
        | undefined;
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
        let originUrl: URL;
        try {
          originUrl = new URL(request.body.origin);
        } catch {
          return reply.code(400).send({ error: 'origin must be a valid URL' });
        }

        const scheme = originUrl.protocol.replace(/:$/, '');
        if (
          scheme !== 'https' &&
          !(scheme === 'http' && originUrl.hostname === 'localhost')
        ) {
          return reply.code(400).send({
            error: 'origin scheme must be https (or http for localhost)',
          });
        }
        if (originUrl.pathname !== '/') {
          return reply
            .code(400)
            .send({ error: 'origin must not have a pathname' });
        }
        if (originUrl.search) {
          return reply
            .code(400)
            .send({ error: 'origin must not have query parameters' });
        }
      }

      // Derive redirect_uri
      const origin =
        request.body.origin ??
        (request.headers['host']
          ? `${(request.headers['x-forwarded-proto'] as string | undefined) ?? 'http'}://${request.headers['host']}`
          : null);

      if (!origin) {
        return reply
          .code(400)
          .send({ error: 'Cannot determine server origin for redirect_uri' });
      }

      const redirectUri = new URL('/oauth/callback', origin).toString();

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

  // GET /api/oauth/status
  fastify.get<{ Querystring: StatusQuery }>(
    '/api/oauth/status',
    async (request, reply) => {
      const config = getConfig();
      if (!config.oauth) {
        return reply.code(501).send({ error: 'OAuth not configured' });
      }

      if (request.accessMode !== 'insider') {
        return reply.code(401).send({ error: 'Insider auth required' });
      }

      const { provider, account } = request.query;
      if (!provider || !account) {
        return reply
          .code(400)
          .send({ error: 'provider and account query params required' });
      }

      const filePath = credentialPath(
        config.oauth.credentialDir,
        provider,
        account,
      );

      let exists = false;
      try {
        await fsp.access(filePath);
        exists = true;
      } catch {
        // file does not exist
      }

      let expired = false;
      if (exists) {
        try {
          const cred = JSON.parse(
            await fsp.readFile(filePath, 'utf8'),
          ) as CredentialFile;
          expired = isExpired(cred);
        } catch {
          expired = true;
        }
      }

      return reply.send({ exists, expired, provider, account });
    },
  );

  // GET /api/oauth/token
  fastify.get<{ Querystring: TokenQuery }>(
    '/api/oauth/token',
    async (request, reply) => {
      const config = getConfig();
      if (!config.oauth) {
        return reply.code(501).send({ error: 'OAuth not configured' });
      }

      if (request.accessMode !== 'insider') {
        return reply.code(401).send({ error: 'Insider auth required' });
      }

      const { provider, account } = request.query;
      if (!provider || !account) {
        return reply
          .code(400)
          .send({ error: 'provider and account query params required' });
      }

      const filePath = credentialPath(
        config.oauth.credentialDir,
        provider,
        account,
      );

      try {
        await fsp.access(filePath);
      } catch {
        return reply.code(404).send({ error: 'Credential file not found' });
      }

      let cred: CredentialFile;
      try {
        cred = JSON.parse(
          await fsp.readFile(filePath, 'utf8'),
        ) as CredentialFile;
      } catch {
        return reply
          .code(500)
          .send({ error: 'Failed to read credential file' });
      }

      // Not expired — return token
      if (!isExpired(cred)) {
        return reply.send({
          access_token: cred.access_token,
          token_type: cred.token_type,
          expires_in_seconds: remainingSeconds(cred),
        });
      }

      // Expired — attempt refresh
      if (!cred.refresh_token) {
        return reply.code(401).send({
          error: 'refresh_failed',
          message: 'Re-authorization required',
        });
      }

      return withFileLock(filePath, async () => {
        try {
          const params = new URLSearchParams();
          params.set('grant_type', 'refresh_token');
          params.set('refresh_token', cred.refresh_token!);
          params.set('client_id', cred.clientId);
          params.set('client_secret', cred.clientSecret);

          const response = await fetch(cred.tokenUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString(),
          });

          if (!response.ok) {
            return await reply.code(401).send({
              error: 'refresh_failed',
              message: 'Re-authorization required',
            });
          }

          const tokenData = (await response.json()) as Record<string, unknown>;

          // Update credential file (atomic write)
          const updated: CredentialFile = {
            ...cred,
            access_token: tokenData.access_token as string,
            token_type:
              (tokenData.token_type as string | undefined) ?? cred.token_type,
            obtained_at: new Date().toISOString(),
          };
          if (tokenData.refresh_token) {
            updated.refresh_token = tokenData.refresh_token as string;
          }
          if (tokenData.expires_in !== undefined) {
            updated.expires_in = tokenData.expires_in as number;
          }
          if (tokenData.scope !== undefined) {
            updated.scope = tokenData.scope as string;
          }

          const tmpPath = filePath + '.tmp';
          await fsp.writeFile(
            tmpPath,
            JSON.stringify(updated, null, 2),
            'utf8',
          );
          await fsp.rename(tmpPath, filePath);

          return await reply.send({
            access_token: updated.access_token,
            token_type: updated.token_type,
            expires_in_seconds: remainingSeconds(updated),
          });
        } catch {
          return reply.code(401).send({
            error: 'refresh_failed',
            message: 'Re-authorization required',
          });
        }
      });
    },
  );

  return Promise.resolve();
};
