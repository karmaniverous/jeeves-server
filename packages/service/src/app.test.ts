/**
 * The app's error handling end to end (#315): every `SERVER_*` code a route can send arrives as its exact standard body, a crash is a masked 500 with no code, runner errors (and their `Retry-After`) pass through the proxy, and unknown routes are HTML for the SPA and `SERVER_NOT_FOUND` otherwise. Runs on the wire harness's app (`registerServerApp`).
 */

import fs from 'node:fs';

import {
  SERVER_ERROR_STATUS,
  type ServerErrorCode,
} from '@karmaniverous/jeeves-server-core';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { WIRE_SCENARIOS } from './test/wire/scenarios.js';
import { startWireApp, type WireApp } from './test/wire/wireApp.js';
import { credentialFor } from './test/wire/wireCredentials.js';
import { CLOSED_PORT_URL } from './test/wire/wireFetchGuard.js';
import { runScenario } from './test/wire/wireRun.js';
import { MASKED_500, serverError } from './testing/testApp.js';

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

/** The scenario named `name`, run; status and parsed body. */
async function scenario(name: string) {
  const found = WIRE_SCENARIOS.find((s) => s.name === name);
  if (!found) throw new Error(`no scenario ${name}`);
  const record = await runScenario(wire, found);
  return {
    status: record.status,
    body: JSON.parse(record.body ?? '') as unknown,
  };
}

describe('SERVER_* error bodies', () => {
  it.each<[string, ServerErrorCode, string]>([
    ['pathKey none', 'SERVER_UNAUTHORIZED', 'X-API-Key header required'],
    ['receiveEvent none', 'SERVER_UNAUTHORIZED', 'Unauthorized'],
    [
      'listEvents scoped session',
      'SERVER_FORBIDDEN',
      'Unscoped insider access required',
    ],
    [
      'browse file out of scope',
      'SERVER_OUT_OF_SCOPE',
      'Path is outside your access scope',
    ],
    [
      'fileWrite path share',
      'SERVER_INSIDER_REQUIRED',
      'Insider access required',
    ],
    ['browse traversal', 'SERVER_INVALID_PATH', 'Invalid path'],
    ['fileContent empty path', 'SERVER_INVALID_PATH', 'Path required'],
    ['spa asset missing', 'SERVER_NOT_FOUND', 'Not found'],
    ['fileWrite missing', 'SERVER_NOT_FOUND', 'File not found'],
    [
      'fileContent directory',
      'SERVER_NOT_A_FILE',
      'Use /api/path/ for directories',
    ],
    [
      'export directory pdf',
      'SERVER_EXPORT_UNSUPPORTED',
      'Directories only support zip or tar export',
    ],
    [
      'diagramExport plantuml unrenderable',
      'SERVER_EXPORT_FAILED',
      'Plantuml render failed',
    ],
    [
      'export pdf without chrome',
      'SERVER_CHROME_UNAVAILABLE',
      'Export unavailable: Chrome could not be started (check chromePath)',
    ],
    ['search session', 'SERVER_WATCHER_UNAVAILABLE', 'Watcher unreachable'],
    [
      'runner GET /api/runner/jobs',
      'SERVER_RUNNER_UNAVAILABLE',
      'Runner unreachable',
    ],
    [
      'rotateKey machine key',
      'SERVER_MACHINE_KEY_NOT_ROTATABLE',
      'Machine keys are rotated in the server config, not through this route',
    ],
    [
      'fileMutate unknown action',
      'SERVER_INVALID_REQUEST',
      'Unknown action: explode',
    ],
    [
      'oauthToken expired',
      'SERVER_OAUTH_REFRESH_FAILED',
      'Re-authorization required',
    ],
  ])('%s: %s', async (name, code, message) => {
    expect(await scenario(name)).toEqual({
      status: SERVER_ERROR_STATUS[code],
      body: serverError(code, message),
    });
  });
});

describe('masked 500', () => {
  it('masks a crash in a route, with no code and nothing of the cause', async () => {
    vi.spyOn(fs.promises, 'writeFile').mockRejectedValue(
      new Error('EACCES: permission denied, open C:\\secret\\path'),
    );
    expect(await scenario('fileWrite')).toEqual({
      status: 500,
      body: MASKED_500,
    });
  });
});

describe('runner errors through the proxy', () => {
  it.each([429, 503])(
    'passes a runner %i through with Retry-After',
    async (status) => {
      const runnerBody = JSON.stringify({
        statusCode: status,
        code: 'RUNNER_BUSY',
        error: 'Busy',
        message: 'try later',
      });
      const original = globalThis.fetch;
      vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) =>
        (input instanceof Request ? input.url : input.toString()).startsWith(
          CLOSED_PORT_URL,
        )
          ? Promise.resolve(
              new Response(runnerBody, {
                status,
                headers: {
                  'content-type': 'application/json',
                  'retry-after': '30',
                },
              }),
            )
          : original(input, init),
      );
      const cred = credentialFor({ machineKey: 'primary' }, wire);
      const res = await wire.app.inject({
        method: 'POST',
        url: `/api/runner/jobs/alpha/run?${cred.query ?? ''}`,
        headers: cred.headers,
      });
      expect(res.statusCode).toBe(status);
      expect(res.headers['retry-after']).toBe('30');
      expect(res.body).toBe(runnerBody);
    },
  );
});

describe('unknown routes', () => {
  it('serves the SPA (here its sign-in page) for an unmatched GET under /browse', async () => {
    const res = await wire.app.inject({ url: '/browse/.hidden/x' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/^text\/html/);
  });

  it.each([
    ['POST', '/browse/x'],
    ['GET', '/no-such-route'],
    ['GET', '/api/no-such-route'],
  ] as const)('answers %s %s with SERVER_NOT_FOUND', async (method, url) => {
    const res = await wire.app.inject({ method, url });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual(serverError('SERVER_NOT_FOUND', 'Not found'));
  });
});
