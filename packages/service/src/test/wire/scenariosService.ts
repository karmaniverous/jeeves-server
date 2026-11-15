/**
 * Wire scenarios for the service and machine routes (`/status`, `/health`, `/config`, `/config/apply`, `/key`, `/insider-key`, the legacy `POST /rotate-key` and `GET /share`, `POST /event`) and the browser routes (static assets, sign-in, OAuth callback, shortlinks, `/path` redirects, the SPA and its fallback, an unknown route). Pure data.
 *
 * @packageDocumentation
 */

import { D, P } from './scenariosContent.js';
import {
  CRED,
  get,
  post,
  scenario,
  shareCred,
  table,
  type WireCred,
  type WireScenario,
  withCred,
} from './wireTypes.js';

/** Status, health and config (config applies write only the temp file). */
const STANDARD: WireScenario[] = [
  get('status', '/status'),
  get('status insider key', '/status', { cred: CRED.insider }),
  scenario('status HEAD', 'HEAD', '/status'),
  get('health', '/health'),
  get('config', '/config'),
  get('config session', '/config', { cred: CRED.session }),
  get('config jsonpath', '/config?path=%24.port'),
  get('config jsonpath no match', '/config?path=%24.nope'),
  get('config invalid jsonpath', '/config?path=%24%5B((('),
  post('configApply invalid config', '/config/apply', {
    patch: { port: 'many' },
  }),
  post('configApply unknown key', '/config/apply', {
    patch: { notAKey: true },
  }),
  post('configApply empty body', '/config/apply', {}),
  scenario('configApply no body', 'POST', '/config/apply'),
  post('configApply valid patch (temp config)', '/config/apply', {
    patch: { eventTimeoutMs: 1000 },
  }),
];

/** Machine-seed key exchange. */
const KEYS: WireScenario[] = [
  get('pathKey', `/key?path=%2F${P.doc}`, { cred: { apiKey: 'primary' } }),
  get('pathKey scoped key', `/key?path=%2F${P.doc}`, {
    cred: { apiKey: 'scoped' },
  }),
  get('pathKey no path', '/key', { cred: { apiKey: 'primary' } }),
  get('pathKey unknown key', `/key?path=%2F${P.doc}`, {
    cred: { apiKey: 'unknown' },
  }),
  get('pathKey none', `/key?path=%2F${P.doc}`),
  get('pathKey insider key in query', `/key?path=%2F${P.doc}`, {
    cred: CRED.insider,
  }),
  get('insiderKey', '/insider-key', { cred: { apiKey: 'primary' } }),
  get('insiderKey scoped key', '/insider-key', { cred: { apiKey: 'scoped' } }),
  get('insiderKey unknown key', '/insider-key', {
    cred: { apiKey: 'unknown' },
  }),
  get('insiderKey none', '/insider-key'),
];

/** Legacy `POST /rotate-key` and `GET /share` (#292). */
const LEGACY: WireScenario[] = [
  ...table<[string, WireCred | undefined]>(
    ['insider key', CRED.insider],
    ['session', CRED.session],
    ['machine key', CRED.machine],
    ['bad key', CRED.bad],
    ['none', undefined],
  ).map(([suffix, cred]) =>
    scenario(
      `legacy rotateKey ${suffix}`,
      'POST',
      '/rotate-key',
      withCred(cred),
    ),
  ),
  ...table<[string, string, WireCred | undefined]>(
    ['insider key', `?path=%2F${P.doc}`, CRED.insider],
    [
      'insider key expiring',
      `?path=%2F${P.doc}&exp=4102444800000`,
      CRED.insider,
    ],
    ['session', `?path=%2F${P.doc}`, CRED.session],
    ['machine key', `?path=%2F${P.doc}`, CRED.machine],
    [
      'scoped insider key out of scope',
      `?path=%2F${P.doc}`,
      CRED.scopedInsider,
    ],
    ['no path', '', CRED.insider],
    ['bad key', `?path=%2F${P.doc}`, CRED.bad],
    ['none', `?path=%2F${P.doc}`, undefined],
  ).map(([suffix, query, cred]) =>
    get(`legacy share ${suffix}`, `/share${query}`, withCred(cred)),
  ),
];

/** `POST /event`. */
const EVENTS: WireScenario[] = [
  post(
    'receiveEvent matched',
    '/event',
    { kind: 'ping' },
    { cred: CRED.machine },
  ),
  post(
    'receiveEvent unmatched',
    '/event',
    { other: 1 },
    { cred: CRED.machine },
  ),
  post('receiveEvent array body', '/event', [1, 2], { cred: CRED.machine }),
  post('receiveEvent scalar body', '/event', 7, { cred: CRED.machine }),
  scenario('receiveEvent empty json body', 'POST', '/event', {
    cred: CRED.machine,
    rawBody: { contentType: 'application/json', body: '' },
  }),
  scenario('receiveEvent text body', 'POST', '/event', {
    cred: CRED.machine,
    rawBody: { contentType: 'text/plain', body: 'hello' },
  }),
  post('receiveEvent none', '/event', { kind: 'ping' }),
  post('receiveEvent bad key', '/event', { kind: 'ping' }, { cred: CRED.bad }),
  post(
    'receiveEvent scoped machine key',
    '/event',
    { kind: 'ping' },
    {
      cred: CRED.scopedMachine,
    },
  ),
  post(
    'receiveEvent insider key',
    '/event',
    { kind: 'ping' },
    {
      cred: CRED.insider,
    },
  ),
  post(
    'receiveEvent path key',
    '/event',
    { kind: 'ping' },
    {
      cred: shareCred('path', '/event', { signer: 'primary' }),
    },
  ),
];

/** Static assets and browser routes (HTML, redirects). */
const BROWSER: WireScenario[] = [
  get('robots', '/robots.txt'),
  get('favicon', '/favicon.svg'),
  get('static lucide', '/static/lucide.min.js', { omitBody: true }),
  get('static panzoom', '/static/panzoom.min.js', { omitBody: true }),
  get('auth login', '/auth/login'),
  get('auth login returnTo', '/auth/login?returnTo=%2Fbrowse%2Fx'),
  get('auth callback error', '/auth/callback?error=access_denied'),
  get('auth callback no code', '/auth/callback'),
  get('auth callback code', '/auth/callback?code=abc&state=%2Fbrowse'),
  get('auth logout', '/auth/logout'),
  get('auth magic verify', '/auth/magic/verify'),
  get('auth magic callback bad token', '/auth/magic/callback?token=bad'),
  get('auth magic callback no token', '/auth/magic/callback'),
  get('oauth callback error', '/oauth/callback?error=denied'),
  get('oauth callback unknown state', '/oauth/callback?code=a&state=nope'),
  get('oauth callback no params', '/oauth/callback'),
  get('go relative', '/go/docs'),
  get('go absolute', '/go/ext'),
  get('go unknown', '/go/nope'),
  get('path redirect', '/path'),
  get('path wildcard redirect', `/path/${P.doc}`),
];

/** The SPA, its sign-in gate and fallback, and unknown routes. */
const SPA: WireScenario[] = [
  get('spa home none', '/'),
  get('spa home session', '/', { cred: CRED.session }),
  get('spa browse none', `/browse/${P.doc}`),
  get('spa browse session', `/browse/${P.doc}`, { cred: CRED.session }),
  get('spa browse path share', `/browse/${P.doc}`, {
    cred: shareCred('path', D.doc),
  }),
  get('spa browse expired share', `/browse/${P.doc}`, {
    cred: shareCred('expired', D.doc),
  }),
  get('spa browse root', '/browse', { cred: CRED.insider }),
  get('spa browse dotfile fallback', '/browse/.hidden', { cred: CRED.session }),
  get('spa runner none', '/runner'),
  get('spa runner job session', '/runner/alpha', { cred: CRED.session }),
  get('spa readme', '/readme'),
  get('spa privacy', '/privacy'),
  get('spa terms', '/terms'),
  get('spa asset', '/app/index.html'),
  get('spa asset missing', '/app/missing.js'),
  get('unknown route', '/nope'),
  post('unknown route POST', '/nope', {}),
  post('unknown route POST under browse', '/browse/x', {}),
  get('unknown api route', '/api/nope', { cred: CRED.session }),
  get('unknown api route none', '/api/nope'),
];

/** Service, machine and browser scenarios. */
export const SCENARIOS_SERVICE: WireScenario[] = [
  ...STANDARD,
  ...KEYS,
  ...LEGACY,
  ...EVENTS,
  ...BROWSER,
  ...SPA,
];
