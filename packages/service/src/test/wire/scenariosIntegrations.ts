/**
 * Wire scenarios for the integration routes: OAuth credential start, status and token (`/api/oauth/*`) and the runner proxy (`/api/runner/*`, runner unreachable). Pure data.
 *
 * @packageDocumentation
 */

import { perCred } from './scenariosSharing.js';
import {
  CRED,
  get,
  post,
  scenario,
  table,
  type WireScenario,
} from './wireTypes.js';

/** OAuth credential routes. */
const OAUTH: WireScenario[] = [
  ...perCred('oauthStart', (name, cred) =>
    post(
      name,
      '/api/oauth/start',
      { provider: 'wire', account: 'me', clientId: 'c', clientSecret: 's' },
      cred ? { cred } : {},
    ),
  ),
  ...table<[string, object]>(
    ['no client credentials', { provider: 'wire', account: 'me' }],
    [
      'unknown provider',
      { provider: 'other', account: 'me', clientId: 'c', clientSecret: 's' },
    ],
    ['missing fields', {}],
    [
      'invalid name',
      { provider: '../x', account: 'me', clientId: 'c', clientSecret: 's' },
    ],
    [
      'origin',
      {
        provider: 'wire',
        account: 'me',
        clientId: 'c',
        clientSecret: 's',
        origin: 'https://other.test',
      },
    ],
    [
      'bad origin',
      {
        provider: 'wire',
        account: 'me',
        clientId: 'c',
        clientSecret: 's',
        origin: 'not a url',
      },
    ],
  ).map(([suffix, body]) =>
    post(`oauthStart ${suffix}`, '/api/oauth/start', body, {
      cred: CRED.session,
    }),
  ),
  ...[
    ['exists', 'provider=wire&account=me'],
    ['expired', 'provider=wire&account=old'],
    ['missing file', 'provider=wire&account=nobody'],
    ['missing params', ''],
    ['invalid name', 'provider=..&account=me'],
  ].flatMap(([suffix, query]) => [
    get(`oauthStatus ${suffix}`, `/api/oauth/status?${query}`, {
      cred: CRED.session,
    }),
    get(`oauthToken ${suffix}`, `/api/oauth/token?${query}`, {
      cred: CRED.session,
    }),
  ]),
  get('oauthStatus none', '/api/oauth/status?provider=wire&account=me'),
  get(
    'oauthToken scoped machine key',
    '/api/oauth/token?provider=wire&account=me',
    {
      cred: CRED.scopedMachine,
    },
  ),
];

/** The runner proxy (runner unreachable). */
const RUNNER: WireScenario[] = [
  ...[
    ['GET', '/api/runner/jobs'],
    ['GET', '/api/runner/jobs/alpha'],
    ['GET', '/api/runner/jobs/alpha/runs?limit=5'],
    ['POST', '/api/runner/jobs/alpha/run'],
    ['POST', '/api/runner/jobs/alpha/enable'],
    ['POST', '/api/runner/jobs/alpha/disable'],
    ['GET', '/api/runner/status'],
  ].map(([method, url]) =>
    scenario(`runner ${method} ${url}`, method as 'GET' | 'POST', url, {
      cred: CRED.session,
    }),
  ),
  ...perCred('runner jobs', (name, cred) =>
    get(name, '/api/runner/jobs', cred ? { cred } : {}),
  ),
  get('runner unknown route', '/api/runner/nope', { cred: CRED.session }),
];

/** Integration scenarios. */
export const SCENARIOS_INTEGRATIONS: WireScenario[] = [...OAUTH, ...RUNNER];
