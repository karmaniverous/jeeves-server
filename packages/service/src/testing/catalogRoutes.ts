/**
 * Test helper: register some catalog entries' handlers as production does (`registerCatalogRoutes`, strict response validation), without the access hook, so a test can set the request's access state itself.
 *
 * @packageDocumentation
 */

import { defineCatalog } from '@karmaniverous/jeeves/catalog';
import { registerCatalogRoutes } from '@karmaniverous/jeeves/fastify';
import {
  SERVER_CATALOG,
  type ServerEntryName,
} from '@karmaniverous/jeeves-server-core';
import type { FastifyPluginAsync } from 'fastify';

import type { HandlersFor } from '../api/handlerTypes.js';
import { beforeValidation } from '../api/routes.js';

/** The request a route-style test passes. */
interface RouteRequest {
  params?: unknown;
  query?: unknown;
  body?: unknown;
}

/** The reply a route-style test captures. */
interface RouteReply {
  code: (status: number) => { send: (body: unknown) => unknown };
}

/**
 * A catalog handler as a Fastify-style `(request, reply)` handler, for
 * tests that call handlers with a fake request and reply: the request's
 * params, query and body (missing ones empty) go in unvalidated, the
 * result's status and body go out through `reply.code(...).send(...)`.
 *
 * @param handler - A catalog handler.
 * @returns The route-style handler.
 */
export function asRouteHandler(
  handler: (
    input: never,
    request: never,
  ) => Promise<{ status: number; body: unknown }>,
) {
  return async (request: unknown, reply: unknown): Promise<unknown> => {
    const { params, query, body } = request as RouteRequest;
    const result = await handler(
      { params: params ?? {}, query: query ?? {}, body: body ?? {} } as never,
      request as never,
    );
    return (reply as RouteReply).code(result.status).send(result.body);
  };
}

/**
 * A plugin registering the catalog entries `handlers` has handlers for.
 *
 * @param handlers - Handlers of some catalog entries.
 * @returns The plugin.
 */
export function catalogRoutes<N extends ServerEntryName>(
  handlers: HandlersFor<N>,
): FastifyPluginAsync {
  const names = new Set<string>(Object.keys(handlers));
  const catalog = defineCatalog(
    SERVER_CATALOG.entries.filter((entry) => names.has(entry.name)),
  );
  return async (app) => {
    app.addHook('preValidation', beforeValidation);
    await registerCatalogRoutes(
      app,
      catalog,
      handlers as unknown as Parameters<typeof registerCatalogRoutes>[2],
      { responseValidation: 'strict' },
    );
  };
}
