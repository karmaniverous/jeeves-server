/**
 * Routes come from the catalog (T9): every `SERVER_CATALOG` entry has a handler and an access class and is registered; no `/api/*` route (nor `/status`, `/config`, `/key`, `/event`...) is registered outside it; `/openapi.json` is served without credentials; a webhook body must be a JSON object (Decision 14).
 *
 * @packageDocumentation
 */

import { SERVER_CATALOG } from '@karmaniverous/jeeves-server-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createServerHandlers } from '../routes/api/index.js';
import {
  type RegisteredRoute,
  startWireApp,
  type WireApp,
} from '../test/wire/wireApp.js';
import { MACHINE_SEEDS } from '../test/wire/wireCredentials.js';
import { computeInsiderKey } from '../util/crypto.js';
import { ROUTE_ACCESS } from './routeAccess.js';

const ENTRY_NAMES = SERVER_CATALOG.entries.map((entry) => entry.name).sort();

/** Catalog entries by "METHOD path". */
const ENTRY_ROUTES = new Set(
  SERVER_CATALOG.entries.map((entry) => `${entry.method} ${entry.path}`),
);

/** Paths only catalog entries may use. */
const CATALOG_PATH =
  /^\/(api\/|status$|config(\/|$)|key$|insider-key$|event$|health$)/u;

/** True when a route is a catalog entry (HEAD shadows a GET entry). */
const isEntry = ({ method, url }: RegisteredRoute) =>
  ENTRY_ROUTES.has(`${method === 'HEAD' ? 'GET' : method} ${url}`);

let wire: WireApp;

beforeAll(async () => {
  wire = await startWireApp();
});

afterAll(async () => {
  await wire.close();
});

describe('routes from the catalog', () => {
  it('has a handler for every entry, and no other', () => {
    expect(Object.keys(createServerHandlers()).sort()).toEqual(ENTRY_NAMES);
  });

  it('has an access class for every entry', () => {
    expect(Object.keys(ROUTE_ACCESS).sort()).toEqual(ENTRY_NAMES);
  });

  it('registers every entry', () => {
    const registered = new Set(
      wire.routes.map(({ method, url }) => `${method} ${url}`),
    );
    for (const route of ENTRY_ROUTES) expect(registered).toContain(route);
  });

  it('registers no API route outside the catalog', () => {
    const outside = wire.routes.filter(
      (route) => CATALOG_PATH.test(route.url) && !isEntry(route),
    );
    expect(outside).toEqual([]);
  });

  it('serves /openapi.json without credentials', async () => {
    const res = await wire.app.inject({ url: '/openapi.json' });
    expect(res.statusCode).toBe(200);
    expect(typeof res.json<{ openapi?: unknown }>().openapi).toBe('string');
  });
});

describe('receiveEvent body (Decision 14)', () => {
  const post = (payload: string, contentType = 'application/json') =>
    wire.app.inject({
      method: 'POST',
      url: `/event?k=${computeInsiderKey(MACHINE_SEEDS.primary)}`,
      headers: { 'content-type': contentType },
      payload,
    });

  it.each([
    ['an array', '[1,2]'],
    ['a scalar', '42'],
    ['a string', '"text"'],
  ])('refuses %s with 400', async (_label, payload) => {
    const res = await post(payload);
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ code: 'FST_ERR_VALIDATION' });
  });
});
