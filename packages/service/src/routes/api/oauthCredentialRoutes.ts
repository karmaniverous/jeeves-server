/**
 * OAuth2 credential routes (insider auth required).
 *
 * GET /api/oauth/status - Check credential existence / expiry
 * GET /api/oauth/token  - Retrieve valid access token (with lazy refresh)
 *
 * @packageDocumentation
 */

import type { FastifyInstance, FastifyRequest } from 'fastify';

import {
  InvalidRequest,
  NotFound,
  OAuthRefreshFailed,
} from '../../api/errors.js';
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
import {
  requireOAuthInsider,
  requireValidCredentialNames,
} from './oauthGuards.js';

/** Query of the credential routes (status, token). */
interface CredentialQuery {
  provider: string;
  account: string;
}

/**
 * Shared preamble of the credential routes: OAuth configured, insider
 * caller, provider and account present and valid.
 *
 * @returns The credential file path.
 * @throws `SERVER_NOT_CONFIGURED`, `SERVER_UNAUTHORIZED` or
 *   `SERVER_INVALID_REQUEST`.
 */
function resolveCredentialFile(
  request: FastifyRequest<{ Querystring: CredentialQuery }>,
): string {
  const oauth = requireOAuthInsider(request);

  const { provider, account } = request.query;
  if (!provider || !account)
    throw new InvalidRequest('provider and account query params required');
  requireValidCredentialNames(provider, account);

  return credentialPath(oauth.credentialDir, provider, account);
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
      const filePath = resolveCredentialFile(request);
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
      const filePath = resolveCredentialFile(request);

      if (!(await credentialExists(filePath)))
        throw new NotFound('Credential file not found');

      // An unreadable credential file is a logged, masked 500.
      const cred = await readCredential(filePath);

      // Not expired: return token
      if (!isExpired(cred)) return reply.send(tokenBody(cred));

      // Expired: attempt refresh
      const refreshToken = cred.refresh_token;
      if (!refreshToken) throw new OAuthRefreshFailed();

      const updated = await withFileLock(filePath, async () => {
        const refreshed = await refreshCredential(cred, refreshToken).catch(
          (cause: unknown) => {
            throw Object.assign(new OAuthRefreshFailed(), { cause });
          },
        );
        if (!refreshed) throw new OAuthRefreshFailed();
        await writeCredential(filePath, refreshed);
        return refreshed;
      });
      return reply.send(tokenBody(updated));
    },
  );
}
