/**
 * Wire scenarios for the content and navigation routes (`/api/drives`, `/api/path/*`, `/api/file/*` reads, `/api/raw/*`, `/api/link-info/*`) under every kind of credential. Writes, exports and diagrams are in `scenariosFiles`. Pure data.
 *
 * @packageDocumentation
 */

import {
  CRED,
  get,
  shareCred,
  type WireCred,
  type WireScenario,
} from './wireTypes.js';

/** Encoded URL paths of corpus entries. */
export const P = {
  root: '{root}',
  doc: '{root}/doc.md',
  markdown: '{root}/notes.markdown',
  json: '{root}/data.json',
  csv: '{root}/data.csv',
  png: '{root}/image.png',
  pdf: '{root}/report.pdf',
  mmd: '{root}/flow.mmd',
  puml: '{root}/seq.puml',
  embedded: '{root}/embedded.md',
  subDir: '{root}/sub%20dir',
  inner: '{root}/sub%20dir/inner.md',
  percent: '{root}/sub%20dir/100%25%20done.md',
  public: '{root}/public',
  shared: '{root}/public/shared.md',
  deeper: '{root}/public/deeper',
  leaf: '{root}/public/deeper/leaf.md',
  private: '{root}/private/secret.md',
  missing: '{root}/missing.md',
  // `%2E%2E/` would be resolved away by the URL parser before the request
  // is sent; an encoded separator keeps the `..` segment in the path.
  traversal: '{root}/sub%20dir/..%2Fdoc.md',
  traversalBackslash: '{root}/sub%20dir/..%5Cdoc.md',
  noRoot: 'zz-no-root/doc.md',
} as const;

/** Decoded content paths (what share keys sign). */
export const D = {
  root: '/{root}',
  doc: '/{root}/doc.md',
  percent: '/{root}/sub dir/100% done.md',
  subDir: '/{root}/sub dir',
  public: '/{root}/public',
  shared: '/{root}/public/shared.md',
  private: '/{root}/private/secret.md',
} as const;

/**
 * Scenarios for one URL under several credentials.
 *
 * @param prefix - Scenario name prefix.
 * @param url - URL.
 * @param creds - Credential variants by name suffix.
 * @returns The scenarios.
 */
export const matrix = (
  prefix: string,
  url: string,
  creds: Record<string, WireCred | undefined>,
): WireScenario[] =>
  Object.entries(creds).map(([suffix, cred]) =>
    get(`${prefix} ${suffix}`, url, cred ? { cred } : {}),
  );

/** `/api/drives`. */
const DRIVES: WireScenario[] = matrix('drives', '/api/drives', {
  none: undefined,
  session: CRED.session,
  'scoped session': CRED.scopedSession,
  'insider key': CRED.insider,
  'machine key': CRED.machine,
  'scoped machine key': CRED.scopedMachine,
  'bad key': CRED.bad,
  'root path share': shareCred('path', D.root),
});

/** `/api/path/*`: listings and file metadata. */
const BROWSE: WireScenario[] = [
  ...matrix('browse root', `/api/path/${P.root}`, {
    none: undefined,
    session: CRED.session,
    'scoped session': CRED.scopedSession,
    'insider key': CRED.insider,
    'scoped insider key': CRED.scopedInsider,
    'machine key': CRED.machine,
    'scoped machine key': CRED.scopedMachine,
    'bad key': CRED.bad,
    'path share': shareCred('path', D.root),
  }),
  ...matrix('browse public', `/api/path/${P.public}`, {
    'scoped session': CRED.scopedSession,
    'scoped machine key': CRED.scopedMachine,
    'path share': shareCred('path', D.public),
    'path share by machine key': shareCred('path', D.public, {
      signer: 'primary',
    }),
    'expiring share': shareCred('expiring', D.public),
    'expired share': shareCred('expired', D.public),
    'deep share': shareCred('deep', D.public),
    'deep share with dirs': shareCred('deepDirs', D.public, { depth: 2 }),
    'share for another path': shareCred('path', D.subDir),
  }),
  get('browse deeper via deep share without dirs', `/api/path/${P.deeper}`, {
    cred: shareCred('deep', D.public),
  }),
  get('browse deeper via tree share', `/api/path/${P.deeper}`, {
    cred: shareCred('path', D.public),
  }),
  get('browse sub dir with space', `/api/path/${P.subDir}`, {
    cred: CRED.session,
  }),
  get('browse file metadata', `/api/path/${P.doc}`, { cred: CRED.session }),
  get('browse file metadata percent name', `/api/path/${P.percent}`, {
    cred: CRED.session,
  }),
  get('browse file out of scope', `/api/path/${P.doc}`, {
    cred: CRED.scopedSession,
  }),
  get('browse missing', `/api/path/${P.missing}`, { cred: CRED.session }),
  get('browse no root', `/api/path/${P.noRoot}`, { cred: CRED.session }),
  get('browse empty path', '/api/path/', { cred: CRED.session }),
  get('browse traversal', `/api/path/${P.traversal}`, { cred: CRED.session }),
  get('browse traversal backslash', `/api/path/${P.traversalBackslash}`, {
    cred: CRED.session,
  }),
];

/** `GET /api/file/*` for each file type. */
const FILE_TYPES: WireScenario[] = [
  ['markdown', P.doc],
  ['markdown raw', `${P.doc}?raw=1`],
  ['dot-markdown', P.markdown],
  ['json', P.json],
  ['csv', P.csv],
  ['csv raw', `${P.csv}?raw=1`],
  ['png', P.png],
  ['pdf', P.pdf],
  ['mermaid cached', P.mmd],
  ['mermaid raw', `${P.mmd}?raw=1`],
  ['plantuml unrenderable', P.puml],
  ['embedded diagram', P.embedded],
  ['percent name', P.percent],
  ['directory', P.subDir],
  ['missing', P.missing],
  ['no root', P.noRoot],
  ['traversal', P.traversal],
  ['traversal backslash', P.traversalBackslash],
].map(([suffix, path]) =>
  get(`fileContent ${suffix}`, `/api/file/${path}`, { cred: CRED.session }),
);

/** `GET /api/file/*` under each credential. */
const FILE_CREDS: WireScenario[] = [
  get('fileContent empty path', '/api/file/', { cred: CRED.session }),
  ...matrix('fileContent', `/api/file/${P.doc}`, {
    none: undefined,
    'insider key': CRED.insider,
    'scoped insider key': CRED.scopedInsider,
    'machine key': CRED.machine,
    'scoped machine key out of scope': CRED.scopedMachine,
    'scoped session out of scope': CRED.scopedSession,
    'bad key': CRED.bad,
    'path share': shareCred('path', D.doc),
    'expiring share': shareCred('expiring', D.doc),
    'expired share': shareCred('expired', D.doc),
    'deep share': shareCred('deep', D.doc, { depth: 0 }),
    'tree share of root': shareCred('path', D.root),
    'share for another path': shareCred('path', D.shared),
  }),
  get('fileContent path share legacy key param', `/api/file/${P.doc}`, {
    cred: shareCred('path', D.doc),
    legacyKeyParam: true,
  }),
  get('fileContent percent name path share', `/api/file/${P.percent}`, {
    cred: shareCred('path', D.percent),
  }),
  ...matrix('fileContent shared', `/api/file/${P.shared}`, {
    'scoped session': CRED.scopedSession,
    'scoped machine key': CRED.scopedMachine,
    'share by scoped insider': shareCred('path', D.shared, {
      signer: 'scoped',
    }),
  }),
  get('fileContent private share', `/api/file/${P.private}`, {
    cred: shareCred('path', D.private),
  }),
];

/** `GET /api/raw/*`. */
const RAW: WireScenario[] = [
  ...[
    ['markdown', P.doc],
    ['png', P.png],
    ['pdf', P.pdf],
    ['json', P.json],
    ['percent name', P.percent],
    ['directory', P.subDir],
    ['missing', P.missing],
    ['no root', P.noRoot],
  ].map(([suffix, path]) =>
    get(`raw ${suffix}`, `/api/raw/${path}`, { cred: CRED.session }),
  ),
  get('raw empty path', '/api/raw/', { cred: CRED.session }),
  ...matrix('raw png', `/api/raw/${P.png}`, {
    none: undefined,
    'path share': shareCred('path', '/{root}/image.png'),
    'scoped machine key': CRED.scopedMachine,
  }),
];

/** `GET /api/link-info/*`. */
const LINK_INFO: WireScenario[] = [
  ...matrix('linkInfo', `/api/link-info/${P.doc}`, {
    none: undefined,
    session: CRED.session,
    'machine key': CRED.machine,
    'path share': shareCred('path', D.doc),
  }),
  get('linkInfo directory', `/api/link-info/${P.subDir}`, {
    cred: CRED.session,
  }),
  get('linkInfo png', `/api/link-info/${P.png}`, { cred: CRED.session }),
  get('linkInfo mermaid', `/api/link-info/${P.mmd}`, { cred: CRED.session }),
  get('linkInfo missing', `/api/link-info/${P.missing}`, {
    cred: CRED.session,
  }),
  get('linkInfo no root', `/api/link-info/${P.noRoot}`, {
    cred: CRED.session,
  }),
  get('linkInfo empty path', '/api/link-info/', { cred: CRED.session }),
];

/** Content and navigation read scenarios. */
export const SCENARIOS_CONTENT: WireScenario[] = [
  ...DRIVES,
  ...BROWSE,
  ...FILE_TYPES,
  ...FILE_CREDS,
  ...RAW,
  ...LINK_INFO,
];
