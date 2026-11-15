/**
 * Decisions 28 and 29 through the real app (the wire harness's `registerServerApp`): the runner proxy forwards only its allow-list (credentials stripped) and answers every other `/api/runner/*` request `SERVER_NOT_FOUND` without calling the runner; every runner proxy entry and the OAuth routes refuse scoped machine keys (`SERVER_FORBIDDEN`) without calling the runner or a token endpoint, and serve sessions (scoped or not) and the plugin's unscoped machine key.
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

import { SCOPED_MACHINE_KEY_ERROR } from './api/accessHook.js';
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

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

const SCOPED_KEY: WireCred = { machineKey: 'scoped' };

/** The callers the runner proxy and OAuth serve. */
const ALLOWED: readonly (readonly [string, WireCred])[] = [
  ['session', { session: 'admin' }],
  ['scoped session', { session: 'scoped' }],
  ['unscoped machine key', { machineKey: 'primary' }],
];

/** The runner proxy entries: request, and the call the runner receives. */
const RUNNER_ENTRIES = [
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
] as const;

const OAUTH_QUERY = 'provider=wire&account=me';
const OAUTH_START_BODY = {
  provider: 'wire',
  account: 'me',
  clientId: 'c',
  clientSecret: 's',
};

/** Runner calls (`method url`) the fake runner received. */
let runnerCalls: string[];
/** Every outbound `fetch` URL (runner and token endpoints alike). */
let fetches: string[];

beforeEach(() => {
  runnerCalls = [];
  fetches = [];
  const original = globalThis.fetch;
  vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    const url = input instanceof Request ? input.url : input.toString();
    fetches.push(url);
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
  method: Method,
  url: string,
  payload: object = {},
) {
  const { query, headers } = credentialFor(cred, wire);
  const sep = url.includes('?') ? '&' : '?';
  return wire.app.inject({
    method,
    url: query ? `${url}${sep}${query}` : url,
    headers,
    ...(method === 'GET' || method === 'DELETE' ? {} : { payload }),
  });
}

describe.each(ALLOWED)('runner proxy allow-list, as a %s', (_name, cred) => {
  it.each(RUNNER_ENTRIES)(
    'forwards %s %s as %s',
    async (method, url, forwarded) => {
      const res = await send(cred, method, url);
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ ok: true });
      expect(runnerCalls).toEqual([forwarded]);
    },
  );
});

describe.each([...ALLOWED, ['scoped machine key', SCOPED_KEY] as const])(
  'runner proxy, other routes, as a %s',
  (_name, cred) => {
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
        expect(res.json()).toEqual(
          serverError('SERVER_NOT_FOUND', 'Not found'),
        );
        expect(runnerCalls).toEqual([]);
      },
    );
  },
);

describe('a scoped machine key (Decision 29)', () => {
  it.each([
    ...RUNNER_ENTRIES.map(([method, url]) => [method, url] as const),
    ['POST', '/api/oauth/start'],
    ['GET', `/api/oauth/status?${OAUTH_QUERY}`],
    ['GET', `/api/oauth/token?${OAUTH_QUERY}`],
  ] as const)('is refused on %s %s, calling nothing', async (method, url) => {
    const res = await send(SCOPED_KEY, method, url, OAUTH_START_BODY);
    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual(
      serverError('SERVER_FORBIDDEN', SCOPED_MACHINE_KEY_ERROR),
    );
    expect(fetches).toEqual([]);
  });
});

describe.each(ALLOWED)('OAuth routes, as a %s', (_name, cred) => {
  it('starts a flow', async () => {
    const res = await send(cred, 'POST', '/api/oauth/start', OAUTH_START_BODY);
    expect(res.statusCode).toBe(200);
  });

  it('reports status', async () => {
    const res = await send(cred, 'GET', `/api/oauth/status?${OAUTH_QUERY}`);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      exists: true,
      expired: false,
      provider: 'wire',
      account: 'me',
    });
  });

  it('serves the token', async () => {
    const res = await send(cred, 'GET', `/api/oauth/token?${OAUTH_QUERY}`);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      access_token: 'wire-access-token',
      token_type: 'Bearer',
    });
  });
});
