/**
 * Request guards shared by the OAuth2 API routes.
 *
 * @packageDocumentation
 */

import type { FastifyRequest } from 'fastify';

import {
  Forbidden,
  InvalidRequest,
  NotConfigured,
  Unauthorized,
} from '../../api/errors.js';
import { getConfig } from '../../config/index.js';
import type { RuntimeConfig } from '../../config/types.js';
import {
  areValidCredentialNames,
  INVALID_CREDENTIAL_NAME_ERROR,
} from '../../services/oauthState.js';

/**
 * The OAuth config, for an insider caller: the preamble of every OAuth API
 * route.
 *
 * @param request - The request.
 * @returns The configured `oauth` block.
 * @throws `SERVER_NOT_CONFIGURED` (501) when OAuth is not configured,
 *   `SERVER_UNAUTHORIZED` (401) without insider access.
 */
export function requireOAuthInsider(
  request: FastifyRequest,
): NonNullable<RuntimeConfig['oauth']> {
  const { oauth } = getConfig();
  if (!oauth) throw new NotConfigured('OAuth not configured');
  if (request.accessMode !== 'insider')
    throw new Unauthorized('Insider auth required');
  return oauth;
}

/** Message of `SERVER_FORBIDDEN` for a scoped machine key on `oauthToken`. */
export const SCOPED_MACHINE_KEY_TOKEN_ERROR =
  'Scoped machine keys may not fetch OAuth tokens';

/**
 * Refuse a scoped machine key (Decision 28): live provider tokens reach
 * past any path scope. Sessions, scoped or not, and unscoped machine keys
 * pass.
 *
 * @param request - The request.
 * @throws `SERVER_FORBIDDEN` (403) for a machine key with scopes.
 */
export function refuseScopedMachineKey(request: FastifyRequest): void {
  const identity = request.access?.identity;
  if (identity?.kind === 'machineKey' && identity.scopes !== null)
    throw new Forbidden(SCOPED_MACHINE_KEY_TOKEN_ERROR);
}

/**
 * Require the provider and account names to be safe credential file names.
 *
 * @param provider - Provider name.
 * @param account - Account name.
 * @throws `SERVER_INVALID_REQUEST` (400) otherwise.
 */
export function requireValidCredentialNames(
  provider: string,
  account: string,
): void {
  if (!areValidCredentialNames(provider, account))
    throw new InvalidRequest(INVALID_CREDENTIAL_NAME_ERROR);
}
