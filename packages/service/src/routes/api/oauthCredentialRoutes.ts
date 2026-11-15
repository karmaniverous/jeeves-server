/**
 * OAuth2 credential routes (insider auth required).
 *
 * GET /api/oauth/status - Check credential existence / expiry
 * GET /api/oauth/token  - Retrieve valid access token (with lazy refresh);
 *   never for a scoped machine key (Decision 28)
 *
 * @packageDocumentation
 */

import type { FastifyRequest } from 'fastify';

import { NotFound, OAuthRefreshFailed } from '../../api/errors.js';
import { type HandlersFor, ok } from '../../api/handlerTypes.js';
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
  refuseScopedMachineKey,
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
 * caller, provider and account valid (present: the catalog checks).
 *
 * @param request - The request.
 * @param query - Its validated query.
 * @returns The credential file path.
 * @throws `SERVER_NOT_CONFIGURED`, `SERVER_UNAUTHORIZED` or
 *   `SERVER_INVALID_REQUEST` (an invalid name).
 */
function resolveCredentialFile(
  request: FastifyRequest,
  { provider, account }: CredentialQuery,
): string {
  const oauth = requireOAuthInsider(request);
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

/** The `oauthStatus` and `oauthToken` handlers. */
export const oauthCredentialHandlers: HandlersFor<
  'oauthStatus' | 'oauthToken'
> = {
  oauthStatus: async ({ query }, request) => {
    const { provider, account } = query;
    const filePath = resolveCredentialFile(request, query);

    const exists = await credentialExists(filePath);

    let expired = false;
    if (exists) {
      try {
        expired = isExpired(await readCredential(filePath));
      } catch {
        expired = true;
      }
    }

    return ok({ exists, expired, provider, account });
  },
  oauthToken: async ({ query }, request) => {
    const filePath = resolveCredentialFile(request, query);
    refuseScopedMachineKey(request);

    if (!(await credentialExists(filePath)))
      throw new NotFound('Credential file not found');

    // An unreadable credential file is a logged, masked 500.
    const cred = await readCredential(filePath);

    // Not expired: return token
    if (!isExpired(cred)) return ok(tokenBody(cred));

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
    return ok(tokenBody(updated));
  },
};
