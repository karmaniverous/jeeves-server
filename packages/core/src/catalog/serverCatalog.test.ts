/**
 * `SERVER_CATALOG` (next-api-catalog.md, Entry inventory): every entry with its method, path, kind and access class, complete descriptions and schemas, the tool names the plugin keeps, the share parameters on content and navigation entries, and the binary entries' content types.
 */

import { type AuthSpec, toToolName } from '@karmaniverous/jeeves/catalog';
import { describe, expect, it } from 'vitest';

import * as root from '../index.js';
import * as browser from './index.js';
import { SERVER_CATALOG } from './serverCatalog.js';

/** Access classes as they appear in an entry's `auth`. */
type Access =
  'public' | 'keyOrSession' | 'insider' | 'machineSeed' | 'eventKey';

/** The inventory: name, method, path, kind and access, in catalog order. */
const INVENTORY = [
  ['status', 'GET', '/status', 'read', 'public'],
  ['config', 'GET', '/config', 'read', 'insider'],
  ['configApply', 'POST', '/config/apply', 'write', 'insider'],
  ['health', 'GET', '/health', 'read', 'public'],
  ['authStatus', 'GET', '/api/auth/status', 'read', 'public'],
  ['sendMagicLink', 'POST', '/api/auth/magic', 'write', 'public'],
  ['pathKey', 'GET', '/key', 'read', 'machineSeed'],
  ['insiderKey', 'GET', '/insider-key', 'read', 'machineSeed'],
  ['search', 'POST', '/api/search', 'read', 'insider'],
  ['searchFacets', 'GET', '/api/search/facets', 'read', 'insider'],
  ['drives', 'GET', '/api/drives', 'read', 'keyOrSession'],
  ['browse', 'GET', '/api/path/*', 'read', 'keyOrSession'],
  ['fileContent', 'GET', '/api/file/*', 'read', 'keyOrSession'],
  ['fileWrite', 'PUT', '/api/file/*', 'write', 'insider'],
  ['fileMutate', 'POST', '/api/file/*', 'write', 'insider'],
  ['raw', 'GET', '/api/raw/*', 'read', 'keyOrSession'],
  ['export', 'GET', '/api/export/*', 'read', 'keyOrSession'],
  ['exportCacheClear', 'DELETE', '/api/export-cache/*', 'write', 'insider'],
  ['exportMermaid', 'GET', '/api/mermaid-export/*', 'read', 'keyOrSession'],
  ['exportPlantUml', 'GET', '/api/plantuml-export/*', 'read', 'keyOrSession'],
  ['linkInfo', 'GET', '/api/link-info/*', 'read', 'keyOrSession'],
  ['diagram', 'GET', '/api/diagram/:type/:hash', 'read', 'public'],
  ['publicContent', 'GET', '/api/public-content/:slug', 'read', 'public'],
  ['share', 'POST', '/api/share', 'read', 'insider'],
  ['shareFor', 'POST', '/api/util/share-for', 'read', 'insider'],
  ['contentLink', 'GET', '/api/content-link/:file', 'read', 'public'],
  ['readmeLink', 'GET', '/api/readme-link', 'read', 'public'],
  ['resolvePath', 'GET', '/api/resolve-path', 'read', 'insider'],
  ['rotateKey', 'POST', '/api/rotate-key', 'destructive', 'insider'],
  ['receiveEvent', 'POST', '/event', 'write', 'eventKey'],
  ['listEvents', 'GET', '/api/events', 'read', 'insider'],
  ['oauthStart', 'POST', '/api/oauth/start', 'write', 'insider'],
  ['oauthStatus', 'GET', '/api/oauth/status', 'read', 'insider'],
  ['oauthToken', 'GET', '/api/oauth/token', 'read', 'insider'],
  ['runnerListJobs', 'GET', '/api/runner/jobs', 'read', 'insider'],
  ['runnerGetJob', 'GET', '/api/runner/jobs/:id', 'read', 'insider'],
  ['runnerListRuns', 'GET', '/api/runner/jobs/:id/runs', 'read', 'insider'],
  ['runnerRunJob', 'POST', '/api/runner/jobs/:id/run', 'write', 'insider'],
  [
    'runnerEnableJob',
    'PATCH',
    '/api/runner/jobs/:id/enable',
    'write',
    'insider',
  ],
  [
    'runnerDisableJob',
    'PATCH',
    '/api/runner/jobs/:id/disable',
    'write',
    'insider',
  ],
  ['runnerStatus', 'GET', '/api/runner/status', 'read', 'insider'],
] as const satisfies readonly (readonly [
  string,
  string,
  string,
  string,
  Access,
])[];

const URL_KEY = { in: 'query', name: 'k' } as const;
const SESSION = { in: 'cookie', name: 'jeeves_session' } as const;

/** The `auth` each access class declares. */
const AUTH: Record<Access, AuthSpec> = {
  public: 'none',
  keyOrSession: { schemes: [URL_KEY, SESSION] },
  insider: { schemes: [URL_KEY, SESSION], insiderOnly: true },
  machineSeed: { schemes: [{ in: 'header', name: 'X-API-Key' }] },
  eventKey: { schemes: [URL_KEY] },
};

/** Content and navigation entries: they take the share parameters. */
const SHARE_QUERY_ENTRIES = INVENTORY.filter(([, , path]) => path.endsWith('*'))
  .map(([name]) => name)
  .concat(['drives', 'authStatus']);

const entries = SERVER_CATALOG.entries;

/**
 * Field names of an object slot schema.
 *
 * @param slot - A slot schema, or undefined.
 * @returns Its keys.
 */
const keysOf = (slot: unknown): string[] =>
  Object.keys((slot as { shape?: object } | undefined)?.shape ?? {});

/**
 * An entry's query slot.
 *
 * @param entry - Catalog entry.
 * @returns Its query schema, or undefined.
 */
const querySlot = (entry: object): unknown =>
  (entry as { query?: unknown }).query;

describe('SERVER_CATALOG', () => {
  it('holds every inventory entry, in order, with its method, path and kind', () => {
    expect(entries.map((e) => [e.name, e.method, e.path, e.kind])).toEqual(
      INVENTORY.map(([name, method, path, kind]) => [name, method, path, kind]),
    );
  });

  it.each(INVENTORY)(
    '%s declares the auth of its access class',
    (name, ...rest) => {
      expect(SERVER_CATALOG.byName(name).auth).toEqual(AUTH[rest[3]]);
    },
  );

  it('describes every entry and gives it a response schema', () => {
    expect(
      entries.filter((e) => e.description.length < 20).map((e) => e.name),
    ).toEqual([]);
    expect(
      entries.filter((e) => typeof e.response.safeParse !== 'function'),
    ).toEqual([]);
  });

  it('names every entry once (names are SDK methods and operationIds)', () => {
    const names = entries.map((e) => e.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('keeps the names of the plugin tools built from the catalog', () => {
    const tools = [
      'browse',
      'linkInfo',
      'fileWrite',
      'fileMutate',
      'exportCacheClear',
      'drives',
      'authStatus',
      'resolvePath',
    ] as const;
    expect(
      tools.map((name) =>
        toToolName('server', SERVER_CATALOG.byName(name).name),
      ),
    ).toEqual([
      'server_browse',
      'server_link_info',
      'server_file_write',
      'server_file_mutate',
      'server_export_cache_clear',
      'server_drives',
      'server_auth_status',
      'server_resolve_path',
    ]);
  });

  it('gives every wildcard route a "*" path parameter', () => {
    const wildcard = entries.filter((x) => x.path.endsWith('*'));
    expect(
      wildcard.map((e) => [e.name, keysOf((e as { params?: unknown }).params)]),
    ).toEqual(wildcard.map((e) => [e.name, ['*']]));
  });

  it.each(SHARE_QUERY_ENTRIES)(
    '%s takes the share parameters in its query',
    (name) => {
      expect(keysOf(querySlot(SERVER_CATALOG.byName(name)))).toEqual(
        expect.arrayContaining(['exp', 'd', 'dirs', 's', 'key']),
      );
    },
  );

  it('takes the share parameters nowhere else', () => {
    expect(
      entries
        .filter((x) => !SHARE_QUERY_ENTRIES.includes(x.name))
        .filter((e) => keysOf(querySlot(e)).includes('dirs'))
        .map((e) => e.name),
    ).toEqual([]);
  });

  it('declares the content type of every binary entry and JSON elsewhere', () => {
    const binary = entries
      .filter((e) => 'contentType' in e)
      .map((e) => [e.name, (e as { contentType: string }).contentType]);
    expect(binary).toEqual([
      ['raw', 'application/octet-stream'],
      ['export', 'application/octet-stream'],
      ['exportMermaid', 'application/octet-stream'],
      ['exportPlantUml', 'application/octet-stream'],
      ['diagram', 'image/svg+xml'],
    ]);
    for (const [name] of binary)
      expect(
        SERVER_CATALOG.byName(name as 'raw').response.safeParse(
          new Uint8Array(1),
        ).success,
      ).toBe(true);
  });

  it('is exported from the main entry and the browser-safe catalog entry', () => {
    expect(root.SERVER_CATALOG).toBe(SERVER_CATALOG);
    expect(browser.SERVER_CATALOG).toBe(SERVER_CATALOG);
    expect(root.SERVER_ERROR_CODES).toBe(browser.SERVER_ERROR_CODES);
    expect(root.shareQuerySchema).toBe(browser.shareQuerySchema);
    expect(root).not.toHaveProperty('serverEndpoints');
  });
});
