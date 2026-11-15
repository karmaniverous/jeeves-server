/**
 * Wire scenarios for the insider API routes: sharing (`/api/share`, `/api/util/share-for`, content and README links, `/api/resolve-path`, `/api/rotate-key`), auth status and magic links, search, events, including scoped machine keys on `/api/resolve-path`, `/api/share` and `/api/search` (#289, #301). Pure data.
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
} from './wireTypes.js';

/** Credentials every insider route is tried with. */
export const INSIDER_CREDS: Record<string, WireCred | undefined> = {
  none: undefined,
  session: CRED.session,
  'scoped session': CRED.scopedSession,
  'insider key': CRED.insider,
  'machine key': CRED.machine,
  'scoped machine key': CRED.scopedMachine,
  'path share': shareCred('path', D.doc),
};

/**
 * One request per credential in {@link INSIDER_CREDS}.
 *
 * @param prefix - Scenario name prefix.
 * @param build - Builds the scenario for a name and credential.
 * @returns The scenarios.
 */
export const perCred = (
  prefix: string,
  build: (name: string, cred: WireCred | undefined) => WireScenario,
): WireScenario[] =>
  Object.entries(INSIDER_CREDS).map(([suffix, cred]) =>
    build(`${prefix} ${suffix}`, cred),
  );

/** `POST /api/share`. */
const SHARE: WireScenario[] = [
  ...perCred('share', (name, cred) =>
    post(name, '/api/share', { path: D.shared }, cred ? { cred } : {}),
  ),
  ...table<[string, object]>(
    ['file', { path: D.doc }],
    ['expiring', { path: D.doc, expiry: '4102444800000' }],
    ['deep', { path: D.subDir, depth: 1, dirs: true }],
    ['directory', { path: D.subDir }],
    ['directory trailing slash', { path: `${D.subDir}/` }],
    ['percent name', { path: D.percent }],
    ['missing path', {}],
  ).map(([suffix, body]) =>
    post(`share ${suffix}`, '/api/share', body, { cred: CRED.session }),
  ),
  post(
    'share scoped session out of scope',
    '/api/share',
    { path: D.doc },
    {
      cred: CRED.scopedSession,
    },
  ),
];

/** `POST /api/util/share-for`. */
const SHARE_FOR: WireScenario[] = [
  ...perCred('shareFor', (name, cred) =>
    post(
      name,
      '/api/util/share-for',
      { path: D.shared, insiders: ['outsider@else.test'] },
      cred ? { cred } : {},
    ),
  ),
  ...table<[string, object]>(
    ['insiders only', { path: D.shared, insiders: ['scoped@wire.test'] }],
    ['blocked insider', { path: D.doc, insiders: ['scoped@wire.test'] }],
    ['policy denied', { path: D.private, insiders: ['x@else.test'] }],
    [
      'policy not enforced',
      {
        path: D.private,
        insiders: ['x@else.test'],
        enforceOutsiderPolicy: false,
      },
    ],
    ['directory tree', { path: D.subDir, insiders: ['x@else.test'] }],
    [
      'deep',
      { path: D.subDir, insiders: ['x@else.test'], depth: 1, dirs: true },
    ],
    ['missing path', { insiders: [] }],
    ['insiders not an array', { path: D.doc, insiders: 'x' }],
  ).map(([suffix, body]) =>
    post(`shareFor ${suffix}`, '/api/util/share-for', body, {
      cred: CRED.insider,
    }),
  ),
  post(
    'shareFor scoped sharer out of scope',
    '/api/util/share-for',
    {
      path: D.doc,
      insiders: ['x@else.test'],
    },
    { cred: CRED.scopedInsider },
  ),
];

/** Content and README links (public). */
const LINKS: WireScenario[] = [
  get('contentLink privacy', '/api/content-link/privacy'),
  get('contentLink terms', '/api/content-link/terms'),
  get('contentLink unknown', '/api/content-link/nope'),
  get('contentLink invalid name', '/api/content-link/bad.name'),
  get('readmeLink', '/api/readme-link'),
];

/** `GET /api/resolve-path`. */
const RESOLVE: WireScenario[] = [
  ...perCred('resolvePath', (name, cred) =>
    get(
      name,
      '/api/resolve-path?fsPath={fsroot}%2Fdoc.md',
      cred ? { cred } : {},
    ),
  ),
  get(
    'resolvePath scoped machine key in scope',
    '/api/resolve-path?fsPath={fsroot}%2Fpublic%2Fshared.md',
    {
      cred: CRED.scopedMachine,
    },
  ),
  get(
    'resolvePath percent name',
    '/api/resolve-path?fsPath={fsroot}%2Fsub%20dir%2F100%25%20done.md',
    {
      cred: CRED.session,
    },
  ),
  get('resolvePath missing fsPath', '/api/resolve-path', {
    cred: CRED.session,
  }),
  get('resolvePath relative', '/api/resolve-path?fsPath=doc.md', {
    cred: CRED.session,
  }),
  get(
    'resolvePath outside roots',
    '/api/resolve-path?fsPath=%2Felsewhere%2Fx.md',
    {
      cred: CRED.session,
    },
  ),
];

/** `POST /api/rotate-key`. */
const ROTATE: WireScenario[] = perCred('rotateKey', (name, cred) =>
  scenario(name, 'POST', '/api/rotate-key', cred ? { cred } : {}),
);

/** `GET /api/auth/status` and `POST /api/auth/magic`. */
const AUTH: WireScenario[] = [
  ...perCred('authStatus', (name, cred) =>
    get(name, `/api/auth/status?path=%2F${P.doc}`, cred ? { cred } : {}),
  ),
  get('authStatus bad key', '/api/auth/status', { cred: CRED.bad }),
  post('sendMagicLink insider', '/api/auth/magic', {
    email: 'admin@wire.test',
    returnTo: '/browse/x',
  }),
  post('sendMagicLink unknown email', '/api/auth/magic', {
    email: 'nobody@wire.test',
  }),
  post('sendMagicLink insider without seed', '/api/auth/magic', {
    email: 'noseed@wire.test',
  }),
  post('sendMagicLink empty body', '/api/auth/magic', {}),
];

/** Search, facets and the event log. */
const SEARCH_EVENTS: WireScenario[] = [
  ...perCred('search', (name, cred) =>
    post(name, '/api/search', { query: 'wire' }, cred ? { cred } : {}),
  ),
  post('search missing query', '/api/search', {}, { cred: CRED.session }),
  ...perCred('searchFacets', (name, cred) =>
    get(name, '/api/search/facets', cred ? { cred } : {}),
  ),
  ...perCred('listEvents', (name, cred) =>
    get(name, '/api/events', {
      ...(cred ? { cred } : {}),
      before: [
        {
          method: 'POST',
          url: '/event',
          payload: { other: 1 },
          cred: CRED.machine,
        },
      ],
    }),
  ),
  get('listEvents limit', '/api/events?limit=1', { cred: CRED.session }),
  get('listEvents limit not a number', '/api/events?limit=abc', {
    cred: CRED.session,
  }),
];

/** Insider API scenarios. */
export const SCENARIOS_SHARING: WireScenario[] = [
  ...SHARE,
  ...SHARE_FOR,
  ...LINKS,
  ...RESOLVE,
  ...ROTATE,
  ...AUTH,
  ...SEARCH_EVENTS,
];
