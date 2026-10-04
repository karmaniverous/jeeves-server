/**
 * Route-level scope guard: answers 403 when the authenticated identity's
 * scopes do not cover a content path. Defence in depth behind the auth
 * middleware, and the only check for body-addressed routes.
 *
 * @packageDocumentation
 */

import type { FastifyReply, FastifyRequest } from 'fastify';

import { canAccessPath } from '../../auth/scopeAccess.js';

/** Error message for out-of-scope requests (403). */
export const OUT_OF_SCOPE_ERROR = 'Path is outside your access scope';

/**
 * Send 403 and return true when `request.insiderScopes` do not grant access
 * to `contentPath` (leading slash optional). Returns false, sending nothing,
 * when access is allowed.
 */
export function rejectOutOfScope(
  request: FastifyRequest,
  reply: FastifyReply,
  contentPath: string,
): boolean {
  const urlPath = '/' + contentPath.replace(/^\/+/, '');
  if (canAccessPath(urlPath, request.insiderScopes)) return false;
  void reply.code(403).send({ error: OUT_OF_SCOPE_ERROR });
  return true;
}
