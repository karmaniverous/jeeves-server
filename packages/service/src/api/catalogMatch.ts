/**
 * Maps a request to the server catalog entry whose route Fastify matched (`request.routeOptions.url` and the method), plus the decoded `*` value. Never re-parses the raw URL: Fastify decodes it before routing, so `/%63onfig` reaches the `/config` route and must be checked as `/config`.
 *
 * @remarks
 * `HEAD` resolves to the `GET` entry (Fastify answers `HEAD` from `GET`
 * routes).
 *
 * @packageDocumentation
 */

import {
  SERVER_CATALOG,
  type ServerEntryName,
} from '@karmaniverous/jeeves-server-core';
import type { FastifyRequest } from 'fastify';

/** A request matched to a catalog entry. */
export interface CatalogMatch {
  /** The entry. */
  name: ServerEntryName;
  /** The decoded `*` value, for wildcard entries. */
  wildcard?: string;
}

/** Catalog entries by "METHOD path" (the path as registered). */
const ENTRIES: ReadonlyMap<string, ServerEntryName> = new Map(
  SERVER_CATALOG.entries.map((entry) => [
    `${entry.method} ${entry.path}`,
    entry.name,
  ]),
);

/**
 * The catalog entry registered at a route.
 *
 * @param method - HTTP method.
 * @param routeUrl - The route's path pattern, as registered.
 * @returns The entry, or undefined for any other route.
 */
export function catalogEntryAt(
  method: string,
  routeUrl: string | undefined,
): ServerEntryName | undefined {
  if (routeUrl === undefined) return undefined;
  return ENTRIES.get(`${method === 'HEAD' ? 'GET' : method} ${routeUrl}`);
}

/**
 * The catalog entry the route Fastify matched for a request belongs to.
 *
 * @param request - The request (routed).
 * @returns The entry and its decoded `*` value.
 * @throws When the route is no catalog entry: callers sit inside the
 *   catalog scope, so an unknown route fails closed (a masked 500).
 */
export function matchCatalogRequest(request: FastifyRequest): CatalogMatch {
  const routeUrl = request.routeOptions.url;
  const name = catalogEntryAt(request.method, routeUrl);
  if (name === undefined)
    throw new Error(
      `Route outside the server catalog: ${request.method} ${String(routeUrl)}`,
    );
  if (!routeUrl?.endsWith('/*')) return { name };
  const params = request.params as { '*'?: string } | undefined;
  return { name, wildcard: params?.['*'] ?? '' };
}
