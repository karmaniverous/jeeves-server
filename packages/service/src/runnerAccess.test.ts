/**
 * Decision 28 through the real app (the wire harness's `registerServerApp`): the runner proxy forwards only its allow-list (credentials stripped) and answers every other `/api/runner/*` request `SERVER_NOT_FOUND` without calling the runner, for a scoped machine key, a session and the plugin's unscoped machine key; `oauthToken` refuses scoped machine keys and serves unscoped machine keys and scoped sessions.
 */

import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { startWireApp, type WireApp } from './test/wire/wireApp.js';
import { credentialFor } from './test/wire/wireCredentials.js';
import { CLOSED_PORT_URL } from './test/wire/wireFetchGuard.js';
import type { WireCred } from './test/wire/wireTypes.js';
import { serverError } from './testing/testApp.js';

let wire: WireApp;

beforeAll(async () => {
  wire = await startWireApp();
});

afterAll(async () => {
  await wire.close();
});

afterEach(() => {
  vi.restoreAllMocks();
  wire.reset();
});

/** The callers: a scoped machine key, a session, the plugin's unscoped key. */
const CALLERS: readonly (readonly [string, WireCred])[] = [
  ['scoped machine key', { machineKey: 'scoped' }],
  ['session', { session: 'admin' }],
  ['unscoped machine key', { machineKey: 'primary' }],
];

/** Runner calls (`method url`) the fake runner received. */
let runnerCalls: string[];

beforeEach(() => {
  runnerCalls = [];
  const original = globalThis.fetch;
  vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    const url = input instanceof Request ? input.url : input.toString();
    if (!url.startsWith(CLOSED_PORT_URL)) return original(input, init);
    runnerCalls.push(
      `${init?.method ?? 'GET'} ${url.slice(CLOSED_PORT_URL.length)}`,
    );
    return Promise.resolve(Response.json({ ok: true }));
  });
});

/**
 * Send a request as a caller, its credential in `k` (machine keys) or the
 * session cookie.
 */
async function send(
  cred: WireCred,
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  url: string,
) {
  const { query, headers } = credentialFor(cred, wire);
  const sep = url.includes('?') ? '&' : '?';
  return wire.app.inject({
    method,
    url: query ? `${url}${sep}${query}` : url,
    headers,
    ...(method === 'GET' || method === 'DELETE' ? {} : { payload: {} }),
  });
}

describe.each(CALLERS)('runner proxy allow-list, as a %s', (_name, cred) => {
  it.each([
    ['GET', '/api/runner/jobs', 'GET /jobs'],
    ['GET', '/api/runner/jobs/alpha', 'GET /jobs/alpha'],
    [
      'GET',
      '/api/runner/jobs/alpha/runs?limit=5',
      'GET /jobs/alpha/runs?limit=5',
    ],
    ['POST', '/api/runner/jobs/alpha/run', 'POST /jobs/alpha/run'],
    ['PATCH', '/api/runner/jobs/alpha/enable', 'PATCH /jobs/alpha/enable'],
    ['PATCH', '/api/runner/jobs/alpha/disable', 'PATCH /jobs/alpha/disable'],
    ['GET', '/api/runner/status', 'GET /status'],
  ] as const)('forwards %s %s as %s', async (method, url, forwarded) => {
    const res = await send(cred, method, url);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    expect(runnerCalls).toEqual([forwarded]);
  });

  it.each([
    ['GET', '/api/runner/config'],
    ['POST', '/api/runner/config/apply'],
    ['POST', '/api/runner/jobs'],
    ['PUT', '/api/runner/jobs/alpha'],
    ['PUT', '/api/runner/jobs/alpha/script'],
    ['DELETE', '/api/runner/jobs/alpha'],
    ['POST', '/api/runner/jobs/alpha/enable'],
    ['GET', '/api/runner/nope/deeper'],
  ] as const)(
    'refuses %s %s, never calling the runner',
    async (method, url) => {
      const res = await send(cred, method, url);
      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual(serverError('SERVER_NOT_FOUND', 'Not found'));
      expect(runnerCalls).toEqual([]);
    },
  );
});

describe('oauthToken by caller', () => {
  const url = '/api/oauth/token?provider=wire&account=me';

  it('refuses a scoped machine key', async () => {
    const res = await send({ machineKey: 'scoped' }, 'GET', url);
    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual(
      serverError(
        'SERVER_FORBIDDEN',
        'Scoped machine keys may not fetch OAuth tokens',
      ),
    );
  });

  it.each([
    ['an unscoped machine key', { machineKey: 'primary' }],
    ['a scoped session', { session: 'scoped' }],
    ['a session', { session: 'admin' }],
  ] as const)('serves %s', async (_name, cred) => {
    const res = await send(cred, 'GET', url);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      access_token: 'wire-access-token',
      token_type: 'Bearer',
    });
  });
});
