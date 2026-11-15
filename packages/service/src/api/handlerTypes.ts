/**
 * Types of the service's catalog handlers: one handler per `SERVER_CATALOG` entry (`ServerHandlers`), typed by jeeves against the entry's request and response schemas, and the handlers a route module contributes (`HandlersFor`). Plus `ok`, a 200 result.
 *
 * @packageDocumentation
 */

import type { CatalogHandlers } from '@karmaniverous/jeeves/fastify';
import type {
  ServerCatalog,
  ServerEntryName,
} from '@karmaniverous/jeeves-server-core';

/** One handler per server catalog entry. */
export type ServerHandlers = CatalogHandlers<ServerCatalog>;

/** The handlers of entries `N` (what one route module contributes). */
export type HandlersFor<N extends ServerEntryName> = Pick<ServerHandlers, N>;

/**
 * A 200 result.
 *
 * @param body - Response body.
 * @param headers - Extra response headers.
 * @returns The handler result.
 */
export const ok = <B>(body: B, headers?: Record<string, string>) => ({
  status: 200 as const,
  body,
  ...(headers ? { headers } : {}),
});
