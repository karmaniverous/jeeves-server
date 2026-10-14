/**
 * Request guards shared by the OAuth2 API routes.
 *
 * @packageDocumentation
 */

import type { FastifyReply } from 'fastify';

import {
  areValidCredentialNames,
  INVALID_CREDENTIAL_NAME_ERROR,
} from '../../services/oauthState.js';

/**
 * Send 400 and return true when the provider or account name is not a safe
 * credential file name.
 */
export function rejectInvalidCredentialNames(
  reply: FastifyReply,
  provider: string,
  account: string,
): boolean {
  if (areValidCredentialNames(provider, account)) return false;
  void reply.code(400).send({ error: INVALID_CREDENTIAL_NAME_ERROR });
  return true;
}
