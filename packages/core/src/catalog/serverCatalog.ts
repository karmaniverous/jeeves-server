/**
 * The jeeves-server endpoint catalog (`SERVER_CATALOG`): one Zod-described entry per machine-API route, from which the service's routes and validation, the OpenAPI document, the SDK client and the plugin's tools are derived; plus the types inferred from it. Pure.
 *
 * @remarks
 * jeeves' three standard entries (`status` public; `config` and
 * `configApply` admin), then the content, sharing, utility, event, OAuth and
 * runner entries. Entry names are the SDK method, the plugin tool's base
 * name (`server_` + snake_case) and the OpenAPI `operationId`. Browser
 * routes (the SPA, sign-in, `/oauth/callback`, `/go/:slug`) are not in it.
 *
 * @packageDocumentation
 */

import {
  type CatalogInput,
  type ClientResponse,
  defineCatalog,
  standardEntries,
} from '@karmaniverous/jeeves/catalog';
import type { z } from 'zod';

import { CONTENT_ENTRIES } from './contentEntries.js';
import { EVENT_ENTRIES } from './eventEntries.js';
import { OAUTH_ENTRIES } from './oauthEntries.js';
import { INSIDER_ONLY } from './route.js';
import { RUNNER_ENTRIES } from './runnerEntries.js';
import { SHARING_ENTRIES } from './sharingEntries.js';
import { serverHealthSchema } from './statusSchemas.js';
import { UTILITY_ENTRIES } from './utilityEntries.js';

/** The jeeves-server endpoint catalog. */
export const SERVER_CATALOG = defineCatalog([
  ...standardEntries('server', {
    auth: { config: INSIDER_ONLY },
    healthSchema: serverHealthSchema,
  }),
  ...UTILITY_ENTRIES,
  ...CONTENT_ENTRIES,
  ...SHARING_ENTRIES,
  ...EVENT_ENTRIES,
  ...OAUTH_ENTRIES,
  ...RUNNER_ENTRIES,
]);

/** The server endpoint catalog's type. */
export type ServerCatalog = typeof SERVER_CATALOG;

/** Name of a server catalog entry. */
export type ServerEntryName = ServerCatalog['entries'][number]['name'];

/** The catalog entry named `N`. */
export type ServerEntry<N extends ServerEntryName> = Extract<
  ServerCatalog['entries'][number],
  { name: N }
>;

/** Request input of entry `N` (params, query and body fields, flat). */
export type ServerInput<N extends ServerEntryName> = CatalogInput<
  ServerEntry<N>
>;

/** Successful response body of entry `N`. */
export type ServerResponse<N extends ServerEntryName> = ClientResponse<
  ServerEntry<N>
>;

/** The server's `health` block in `GET /status`. */
export type ServerHealth = z.output<typeof serverHealthSchema>;
