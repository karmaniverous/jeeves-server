// @vitest-environment node
/**
 * The access matrix (Decision 8) through the real app (`registerServerApp`): one real catalog route per access class against every kind of credential, including the `_internal` key (never an admin, still reads content for export renders), expired share keys, and share keys on public, machineSeed and eventKey entries.
 *
 * @packageDocumentation
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { startWireApp, type WireApp } from '../test/wire/wireApp.js';
import { credentialFor } from '../test/wire/wireCredentials.js';
import type { WireCred } from '../test/wire/wireTypes.js';
import type { AccessClass } from './routeAccess.js';

let wire: WireApp;

beforeAll(async () => {
  wire = await startWireApp();
});

afterAll(async () => {
  await wire.close();
});

/** A real catalog route per class (`{root}`: the content root). */
const ROUTES: Record<
  AccessClass,
  { method: 'GET' | 'POST' | 'DELETE'; url: string; payload?: object }
> = {
  public: { method: 'GET', url: '/health' },
  machineSeed: { method: 'GET', url: '/insider-key' },
  eventKey: { method: 'POST', url: '/event', payload: { kind: 'ping' } },
  navigation: { method: 'GET', url: '/api/path/{root}/public' },
  content: { method: 'GET', url: '/api/file/{root}/public/shared.md' },
  'content+insider': {
    method: 'DELETE',
    url: '/api/export-cache/{root}/public/shared.md',
  },
  insider: {
    method: 'POST',
    url: '/api/share',
    payload: { path: '/{root}/public/shared.md' },
  },
  admin: { method: 'GET', url: '/config' },
};

const CLASSES = Object.keys(ROUTES) as AccessClass[];

/** Outcome: 2xx, or the status and code. */
type Outcome = 'ok' | `${string} ${string}`;

const E401 = '401 SERVER_UNAUTHORIZED';
const E403_ADMIN = '403 SERVER_FORBIDDEN';
const E403_INSIDER = '403 SERVER_INSIDER_REQUIRED';

/** Every class `outcome`, with overrides. */
const all = (
  outcome: Outcome,
  overrides: Partial<Record<AccessClass, Outcome>> = {},
): Record<AccessClass, Outcome> => ({
  ...(Object.fromEntries(CLASSES.map((c) => [c, outcome])) as Record<
    AccessClass,
    Outcome
  >),
  ...overrides,
});

const PUBLIC_DIR = '/{root}/public';

const MATRIX: [string, WireCred | undefined, Record<AccessClass, Outcome>][] = [
  ['none', undefined, all(E401, { public: 'ok' })],
  [
    'admin session',
    { session: 'admin' },
    all('ok', { machineSeed: E401, eventKey: E401 }),
  ],
  [
    'scoped session',
    { session: 'scoped' },
    all('ok', { machineSeed: E401, eventKey: E401, admin: E403_ADMIN }),
  ],
  ['machine key', { machineKey: 'primary' }, all('ok', { machineSeed: E401 })],
  [
    'scoped machine key',
    { machineKey: 'scoped' },
    all('ok', { machineSeed: E401, eventKey: E401, admin: E403_ADMIN }),
  ],
  [
    '_internal machine key',
    { machineKey: 'internal' },
    all('ok', { machineSeed: E401, admin: E403_ADMIN }),
  ],
  ['insider-seed key', { insiderKey: 'admin' }, all(E401, { public: 'ok' })],
  [
    'share key',
    { share: 'path', path: PUBLIC_DIR },
    all(E401, {
      public: 'ok',
      navigation: 'ok',
      content: 'ok',
      'content+insider': E403_INSIDER,
    }),
  ],
  [
    'expired share key',
    { share: 'expired', path: PUBLIC_DIR },
    all(E401, { public: 'ok' }),
  ],
  [
    'share key for /event by a machine key',
    { share: 'path', path: '/event', signer: 'primary' },
    all(E401, { public: 'ok', eventKey: 'ok' }),
  ],
  [
    'share key for /event by an insider',
    { share: 'path', path: '/event' },
    all(E401, { public: 'ok' }),
  ],
  ['bad key', { badKey: true }, all(E401, { public: 'ok' })],
];

/** Send `cls`'s route with `cred`. */
async function send(cls: AccessClass, cred: WireCred | undefined) {
  const route = ROUTES[cls];
  const root = wire.rootUrl.slice(1);
  const { query, headers } = credentialFor(cred, wire);
  const url = route.url.split('{root}').join(root);
  const payload = route.payload
    ? (JSON.parse(
        JSON.stringify(route.payload).split('{root}').join(root),
      ) as object)
    : undefined;
  wire.reset();
  return wire.app.inject({
    method: route.method,
    url: `${url}${query ? `?${query}` : ''}`,
    headers,
    ...(payload ? { payload } : {}),
  });
}

const cases = MATRIX.flatMap(([label, cred, expected]) =>
  CLASSES.map((cls) => [cls, label, cred, expected[cls]] as const),
);

describe('access classes on real catalog routes', () => {
  it.each(cases)('%s, %s', async (cls, _label, cred, outcome) => {
    const res = await send(cls, cred);
    const actual: Outcome =
      res.statusCode < 300
        ? 'ok'
        : `${String(res.statusCode)} ${String(res.json<{ code?: string }>().code)}`;
    expect(actual).toBe(outcome);
  });
});

describe('the _internal machine key', () => {
  const internal = { machineKey: 'internal' } as const;

  it('cannot apply config', async () => {
    const { query } = credentialFor(internal, wire);
    const res = await wire.app.inject({
      method: 'POST',
      url: `/config/apply?${String(query)}`,
      payload: { patch: { eventTimeoutMs: 1 } },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json<{ code: string }>().code).toBe('SERVER_FORBIDDEN');
  });

  it('reads what an export render loads (file and raw)', async () => {
    const { query } = credentialFor(internal, wire);
    const root = wire.rootUrl.slice(1);
    for (const route of ['file', 'raw']) {
      const res = await wire.app.inject(
        `/api/${route}/${root}/private/secret.md?${String(query)}`,
      );
      expect([route, res.statusCode]).toEqual([route, 200]);
    }
  });

  it('gets no admin detail from /status', async () => {
    const { query } = credentialFor(internal, wire);
    const admin = credentialFor({ machineKey: 'primary' }, wire);
    const [asInternal, asAdmin] = await Promise.all([
      wire.app.inject(`/status?${String(query)}`),
      wire.app.inject(`/status?${String(admin.query)}`),
    ]);
    expect(asInternal.body.length).toBeLessThan(asAdmin.body.length);
  });
});
