/**
 * The catalog routes: every `SERVER_CATALOG` entry, registered from the catalog in one child plugin whose `onRequest` is the access hook (Decision 8), with strict response validation; and `/openapi.json`, outside the child so it stays unauthenticated. Browser routes are registered elsewhere, outside the catalog.
 *
 * @packageDocumentation
 */

import {
  registerCatalogRoutes,
  registerOpenApiRoute,
} from '@karmaniverous/jeeves/fastify';
import {
  SERVER_CATALOG,
  SERVER_OPENAPI_DOCUMENT,
  type ServerEntryName,
} from '@karmaniverous/jeeves-server-core';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import { addAccessHook } from './accessHook.js';
import { matchCatalogRequest } from './catalogMatch.js';
import type { ServerHandlers } from './handlerTypes.js';

/** Entries whose body may be missing (the webhook): validated as `{}`. */
const EMPTY_BODY_ENTRIES: ReadonlySet<ServerEntryName> = new Set([
  'receiveEvent',
]);

/**
 * Before validation (entry from the matched route, as the access hook
 * finds it; a route outside the catalog throws): a missing body is `{}` on the entries that allow one,
 * and `GET /api/path/` (an empty browse path) redirects to the drives.
 *
 * @param request - The request.
 * @param reply - The reply.
 * @returns The reply when it was sent (ending the request), else undefined.
 */
export function beforeValidation(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<unknown> {
  const entry = matchCatalogRequest(request).name;
  if (EMPTY_BODY_ENTRIES.has(entry)) request.body ??= {};
  if (entry === 'browse' && (request.params as { '*'?: string })['*'] === '')
    return Promise.resolve(reply.redirect('/api/drives'));
  return Promise.resolve(undefined);
}

/** Options for {@link registerApiRoutes}. */
export interface ApiRoutesOptions {
  /** One handler per catalog entry. */
  handlers: ServerHandlers;
}

/**
 * Register the catalog routes and `/openapi.json`.
 *
 * @param app - The app.
 * @param options - The handlers.
 */
export async function registerApiRoutes(
  app: FastifyInstance,
  { handlers }: ApiRoutesOptions,
): Promise<void> {
  registerOpenApiRoute(app, SERVER_OPENAPI_DOCUMENT);
  await app.register(async (child) => {
    // Access model (Decision 8): every catalog route, before it is parsed.
    addAccessHook(child);
    child.addHook('preValidation', beforeValidation);
    await registerCatalogRoutes(child, SERVER_CATALOG, handlers, {
      responseValidation: 'strict',
      logger: app.log,
    });
  });
}
