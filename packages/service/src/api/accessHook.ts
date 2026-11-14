/**
 * The access hook (`onRequest`): enforces each catalog entry's access class (`ROUTE_ACCESS`, Decision 8) before the request is parsed, and stores who is calling on the request. Routes outside the catalog (browser routes, the legacy routes) and unknown URLs pass through untouched.
 *
 * @remarks
 * Public entries resolve an identity when one is present and never fail on
 * it. The key-exchange and webhook entries verify their machine seed or
 * event key. Every other entry rejects a `..` segment in its content path,
 * then resolves an identity (session, machine insider key, and the
 * insider-seed insider key only where `loginSeedKey`): `admin` needs one with
 * no scopes (Decision 12); on content and navigation entries an identity
 * outside its scopes falls back to a valid share credential (as an outsider,
 * with the signer's scopes), else `SERVER_OUT_OF_SCOPE`. Without an
 * identity, a share credential valid for the content path admits an
 * outsider (`content+insider`: `SERVER_INSIDER_REQUIRED`); otherwise
 * `SERVER_UNAUTHORIZED`. Handlers of `insider` entries check the paths they
 * address against the identity's scopes.
 *
 * @packageDocumentation
 */

import type { FastifyInstance, FastifyRequest } from 'fastify';

import {
  eventKeyFor,
  type Identity,
  machineSeedFor,
  resolveIdentity,
  type ShareGrant,
  verifyShareCredential,
} from '../auth/credentials.js';
import type { AuthQuery } from '../auth/resolve.js';
import { canAccessPath, canNavigatePath } from '../auth/scopeAccess.js';
import { getConfig } from '../config/index.js';
import {
  hasTraversalSegment,
  parseContentRoute,
} from '../routes/api/contentRoute.js';
import { INSIDER_REQUIRED_ERROR } from '../routes/api/scopeGuard.js';
import { matchCatalogRoute } from './catalogMatch.js';
import {
  Forbidden,
  InsiderRequired,
  InvalidPath,
  OutOfScope,
  Unauthorized,
} from './errors.js';
import { type RouteAccess, routeAccess } from './routeAccess.js';

/** Message of `SERVER_FORBIDDEN` on `admin` entries. */
export const UNSCOPED_INSIDER_REQUIRED_ERROR =
  'Unscoped insider access required';

/**
 * Record an identity on the request.
 *
 * @param request - The request.
 * @param identity - Who is calling.
 */
function admitIdentity(request: FastifyRequest, identity: Identity): void {
  if (request.access) request.access.identity = identity;
  request.accessMode = 'insider';
  request.authSeed = identity.seed;
  request.insiderScopes = identity.scopes;
  if (identity.email !== undefined) request.insiderEmail = identity.email;
  if (identity.keyAge !== undefined) request.keyAge = identity.keyAge;
}

/**
 * Record a share credential on the request, as an outsider.
 *
 * @param request - The request.
 * @param access - The entry's access.
 * @param grant - The verified share credential.
 * @throws `SERVER_INSIDER_REQUIRED` (403) on `content+insider` entries.
 */
function admitOutsider(
  request: FastifyRequest,
  access: RouteAccess,
  grant: ShareGrant,
): void {
  if (access.class === 'content+insider')
    throw new InsiderRequired(INSIDER_REQUIRED_ERROR);
  request.accessMode = 'outsider';
  request.authSeed = grant.seed;
  request.insiderScopes = grant.scopes;
  request.authMatchedPath = grant.matchedPath;
  if (grant.deepShareParams) request.deepShareParams = grant.deepShareParams;
}

/**
 * True when `scopes` allow the entry's content path: navigation admits
 * non-denied ancestors of allowed paths, content needs the path itself.
 */
function scopesAllow(
  access: RouteAccess,
  contentPath: string,
  identity: Identity,
): boolean {
  return access.class === 'navigation'
    ? canNavigatePath(contentPath, identity.scopes)
    : canAccessPath(contentPath, identity.scopes);
}

/**
 * Enforce the access class of the catalog entry a request addresses.
 *
 * @param request - The request.
 * @throws `SERVER_INVALID_PATH` (400), `SERVER_UNAUTHORIZED` (401),
 *   `SERVER_FORBIDDEN`, `SERVER_OUT_OF_SCOPE` or `SERVER_INSIDER_REQUIRED`
 *   (403), per the access model.
 */
export function authorizeRequest(request: FastifyRequest): void {
  if (request.is404) return;
  const match = matchCatalogRoute(request.method, request.url);
  if (!match) return;
  const access = routeAccess(match.name);
  request.access = { entry: match.name, class: access.class };
  const config = getConfig();
  const query = (request.query ?? {}) as AuthQuery;

  if (access.class === 'machineSeed') {
    const key = machineSeedFor(config, request.headers['x-api-key']);
    request.access.machineKey = key.name;
    request.authSeed = key.seed;
    return;
  }
  if (access.class === 'eventKey') {
    request.access.machineKey = eventKeyFor(config, query);
    return;
  }
  if (access.class === 'public') {
    const identity = resolveIdentity(config, request, query, false);
    if (identity) admitIdentity(request, identity);
    return;
  }

  const contentPath = parseContentRoute(match, access)?.path;
  if (contentPath !== undefined && hasTraversalSegment(contentPath))
    throw new InvalidPath('Invalid path');

  const identity = resolveIdentity(config, request, query, access.loginSeedKey);
  if (identity) {
    if (access.class === 'admin' && identity.scopes !== null)
      throw new Forbidden(UNSCOPED_INSIDER_REQUIRED_ERROR);
    if (
      contentPath === undefined ||
      scopesAllow(access, contentPath, identity)
    ) {
      admitIdentity(request, identity);
      return;
    }
    const grant = verifyShareCredential(config, contentPath, query);
    if (!grant) throw new OutOfScope();
    admitOutsider(request, access, grant);
    return;
  }

  const grant =
    contentPath === undefined
      ? undefined
      : verifyShareCredential(config, contentPath, query);
  if (!grant) throw new Unauthorized('Unauthorized');
  admitOutsider(request, access, grant);
}

/**
 * Add the access hook to an app (before its routes).
 *
 * @param app - The app.
 */
export function addAccessHook(app: FastifyInstance): void {
  app.addHook('onRequest', (request, _reply, done) => {
    authorizeRequest(request);
    done();
  });
}

/**
 * True when the caller is an admin: an identity with no scopes configured
 * (Decision 12).
 *
 * @param request - The request.
 * @returns Whether it is.
 */
export const isAdmin = (request: FastifyRequest): boolean =>
  request.access?.identity?.scopes === null;
