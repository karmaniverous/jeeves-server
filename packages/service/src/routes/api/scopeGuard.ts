/**
 * Route-level guards: throw `SERVER_INSIDER_REQUIRED` when a route needs insider access, and `SERVER_OUT_OF_SCOPE` when the authenticated identity's scopes do not cover a content path. Defence in depth behind the access hook, and the only check for body-addressed routes.
 *
 * @packageDocumentation
 */

import type { FastifyRequest } from 'fastify';

import { InsiderRequired, OutOfScope } from '../../api/errors.js';
import { canAccessPath } from '../../auth/scopeAccess.js';

/** Message of `SERVER_INSIDER_REQUIRED` on insider-only routes. */
export const INSIDER_REQUIRED_ERROR = 'Insider access required';

/**
 * Require insider access (session, insider key or machine key). Share links
 * never pass.
 *
 * @param request - The request.
 * @throws `SERVER_INSIDER_REQUIRED` (403) without insider access.
 */
export function requireInsider(request: FastifyRequest): void {
  if (request.accessMode !== 'insider')
    throw new InsiderRequired(INSIDER_REQUIRED_ERROR);
}

/**
 * Require `request.insiderScopes` to grant access to `contentPath` (leading
 * slash optional).
 *
 * @param request - The request.
 * @param contentPath - The content path the route addresses.
 * @throws `SERVER_OUT_OF_SCOPE` (403) outside the caller's scopes.
 */
export function requireInScope(
  request: FastifyRequest,
  contentPath: string,
): void {
  const urlPath = '/' + contentPath.replace(/^\/+/, '');
  if (!canAccessPath(urlPath, request.insiderScopes)) throw new OutOfScope();
}
