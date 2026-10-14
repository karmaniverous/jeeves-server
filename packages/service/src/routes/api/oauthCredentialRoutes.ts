/**
 * OAuth2 credential routes (insider auth required).
 *
 * GET /api/oauth/status - Check credential existence / expiry
 * GET /api/oauth/token  - Retrieve valid access token (with lazy refresh)
 *
 * @packageDocumentation
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import { getConfig } from '../../config/index.js';
import {
  credentialExists,
  type CredentialFile,
  isExpired,
  readCredential,
  refreshCredential,
  remainingSeconds,
  writeCredential,
} from '../../services/oauthCredentialStore.js';
import { credentialPath } from '../../services/oauthState.js';
import { withFileLock } from '../../util/fileMutex.js';
import { rejectInvalidCredentialNames } from './oauthGuards.js';

/** Query of the credential routes (status, token). */
interface CredentialQuery {
  provider: string;
  account: string;
}

/** Response body when a token cannot be refreshed. */
const REFRESH_FAILED = {
  error: 'refresh_failed',
  message: 'Re-authorization required',
};

/**
 * Shared preamble of the credential routes: OAuth configured (501), insider
 * caller (401), provider and account present (400) and valid (400). Sends
 * the error and returns null, or returns the credential file path.
 */
function resolveCredentialFile(
  request: FastifyRequest<{ Querystring: CredentialQuery }>,
  reply: FastifyReply,
): string | null {
  const config = getConfig();
  if (!config.oauth) {
    void reply.code(501).send({ error: 'OAuth not configured' });
    return null;
  }

  if (request.accessMode !== 'insider') {
    void reply.code(401).send({ error: 'Insider auth required' });
    return null;
  }

  const { provider, account } = request.query;
  if (!provider || !account) {
    void reply
      .code(400)
      .send({ error: 'provider and account query params required' });
    return null;
  }

  if (rejectInvalidCredentialNames(reply, provider, account)) return null;

  return credentialPath(config.oauth.credentialDir, provider, account);
}

/** Token response body for a credential. */
function tokenBody(cred: CredentialFile) {
  return {
    access_token: cred.access_token,
    token_type: cred.token_type,
    expires_in_seconds: remainingSeconds(cred),
  };
}

/** Register `GET /api/oauth/status` and `GET /api/oauth/token`. */
export function registerOAuthCredentialRoutes(fastify: FastifyInstance): void {
  // GET /api/oauth/status
  fastify.get<{ Querystring: CredentialQuery }>(
    '/api/oauth/status',
    async (request, reply) => {
      const filePath = resolveCredentialFile(request, reply);
      if (!filePath) return reply;
      const { provider, account } = request.query;

      const exists = await credentialExists(filePath);

      let expired = false;
      if (exists) {
        try {
          expired = isExpired(await readCredential(filePath));
        } catch {
          expired = true;
        }
      }

      return reply.send({ exists, expired, provider, account });
    },
  );

  // GET /api/oauth/token
  fastify.get<{ Querystring: CredentialQuery }>(
    '/api/oauth/token',
    async (request, reply) => {
      const filePath = resolveCredentialFile(request, reply);
      if (!filePath) return reply;

      if (!(await credentialExists(filePath))) {
        return reply.code(404).send({ error: 'Credential file not found' });
      }

      let cred: CredentialFile;
      try {
        cred = await readCredential(filePath);
      } catch {
        return reply
          .code(500)
          .send({ error: 'Failed to read credential file' });
      }

      // Not expired: return token
      if (!isExpired(cred)) return reply.send(tokenBody(cred));

      // Expired: attempt refresh
      const refreshToken = cred.refresh_token;
      if (!refreshToken) return reply.code(401).send(REFRESH_FAILED);

      return withFileLock(filePath, async () => {
        try {
          const updated = await refreshCredential(cred, refreshToken);
          if (!updated) return await reply.code(401).send(REFRESH_FAILED);
          await writeCredential(filePath, updated);
          return await reply.send(tokenBody(updated));
        } catch {
          return reply.code(401).send(REFRESH_FAILED);
        }
      });
    },
  );
}
