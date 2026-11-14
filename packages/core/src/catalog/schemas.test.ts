/**
 * Request and response schemas of `SERVER_CATALOG` that carry rules of their own: the `fileMutate` per-action refinement, `receiveEvent` objects only (Decision 14), the opaque runner entries, the `status` health block (Decision 22 and the 3.16.0 additions), `browse` unions and the share query.
 */

import { describe, expect, it } from 'vitest';

import { FILE_MUTATION_REQUIRED_FIELDS } from './fileMutateSchema.js';
import { SERVER_CATALOG } from './serverCatalog.js';

const mutate = SERVER_CATALOG.byName('fileMutate').body;

/** A complete body for each action. */
const VALID = {
  'edit-block': { startLine: 1, endLine: 2, content: 'x' },
  'delete-block': { startLine: 1, endLine: 2 },
  'insert-block': { atLine: 1, position: 'after', content: 'x' },
  'edit-cell': { line: 1, col: 0, content: 'x' },
  'toggle-checkbox': { index: 0, checked: true },
} as const;

describe('fileMutate body', () => {
  it.each(Object.entries(VALID))('accepts a complete %s', (action, fields) => {
    expect(mutate.parse({ action, ...fields })).toEqual({ action, ...fields });
  });

  it.each(Object.entries(FILE_MUTATION_REQUIRED_FIELDS))(
    'requires every field of %s',
    (action, required) => {
      const full = VALID[action as keyof typeof VALID] as Record<
        string,
        unknown
      >;
      for (const field of required) {
        const body = Object.fromEntries(
          Object.entries({ action, ...full }).filter(([k]) => k !== field),
        );
        const result = mutate.safeParse(body);
        expect(result.error?.issues).toEqual([
          expect.objectContaining({
            path: [field],
            message: `${action} requires ${field}`,
          }),
        ]);
      }
    },
  );

  it('refuses an unknown action and fractional line numbers', () => {
    expect(mutate.safeParse({ action: 'rename' }).success).toBe(false);
    expect(
      mutate.safeParse({ action: 'delete-block', startLine: 1.5, endLine: 2 })
        .success,
    ).toBe(false);
  });
});

describe('receiveEvent body', () => {
  const body = SERVER_CATALOG.byName('receiveEvent').body;

  it('accepts any JSON object and keeps every field', () => {
    const event = { kind: 'ping', nested: { a: [1, 2] } };
    expect(body.parse(event)).toEqual(event);
    expect(body.parse({})).toEqual({});
  });

  it.each([[[1, 2]], ['text'], [3], [null]])('refuses %j', (value) => {
    expect(body.safeParse(value).success).toBe(false);
  });
});

describe('runner proxy entries', () => {
  it.each([
    'runnerGet',
    'runnerPost',
    'runnerPatch',
    'runnerPut',
    'runnerDelete',
  ] as const)('%s passes any response, and its query, through', (name) => {
    const entry = SERVER_CATALOG.byName(name);
    for (const value of [{ jobs: [] }, [1], 'text', null])
      expect(entry.response.parse(value)).toEqual(value);
    expect(entry.query.parse({ limit: '5' })).toEqual({ limit: '5' });
  });

  it('sends a pass-through body only on POST, PATCH and PUT', () => {
    const withBody = SERVER_CATALOG.entries
      .filter((e) => e.name.startsWith('runner') && 'body' in e)
      .map((e) => e.name);
    expect(withBody).toEqual(['runnerPost', 'runnerPatch', 'runnerPut']);
    expect(
      SERVER_CATALOG.byName('runnerPost').body.parse({ any: { thing: 1 } }),
    ).toEqual({ any: { thing: 1 } });
  });
});

describe('status health', () => {
  const status = SERVER_CATALOG.byName('status').response;
  const health = {
    port: 1934,
    chrome: { configured: true, path: '/usr/bin/chrome' },
    auth: { modes: ['keys'], insiderCount: 1, keyCount: 2 },
    events: [{ name: 'ping', cmd: 'echo' }],
    exports: {
      documents: ['pdf'],
      directories: ['zip'],
      diagrams: ['svg'],
      chromeAvailable: true,
    },
    diagrams: { mermaid: true, plantuml: { localJar: false, servers: [] } },
    services: {
      watcher: { url: 'http://w', reachable: true, version: '1' },
      runner: { url: 'http://r', reachable: false },
      meta: { url: 'http://m', reachable: false },
      lastChecked: null,
    },
    branding: { name: 'Jeeves', emoji: 'J' },
  };
  const body = {
    name: 'server',
    version: '3.16.0',
    uptime: 1,
    status: 'healthy',
    health,
  };

  it('accepts the admin block with commands and the Chrome path', () => {
    expect(status.parse(body)).toEqual(body);
  });

  it('accepts the block without them (callers that are not admin)', () => {
    const redacted = {
      ...body,
      health: {
        ...health,
        chrome: { configured: true },
        events: [{ name: 'ping' }],
      },
    };
    expect(status.parse(redacted)).toEqual(redacted);
  });

  it('keeps the redirect URIs and the event queue block', () => {
    const extended = {
      ...body,
      health: {
        ...health,
        auth: {
          ...health.auth,
          googleRedirectUri: 'https://x/auth/callback',
          oauthRedirectUri: 'https://x/oauth/callback',
        },
        eventQueue: {
          offset: 10,
          size: 20,
          pendingBytes: 10,
          parseErrors: 0,
          lastRewind: '2026-11-14T00:00:00.000Z',
        },
      },
    };
    expect(status.parse(extended)).toEqual(extended);
  });

  it('refuses a block with a wrong type', () => {
    expect(
      status.safeParse({ ...body, health: { ...health, port: '1934' } })
        .success,
    ).toBe(false);
  });
});

describe('browse response', () => {
  const browse = SERVER_CATALOG.byName('browse').response;

  it('is file metadata or a directory listing, nothing else', () => {
    const file = {
      type: 'file',
      path: 'r/a.md',
      ext: '.md',
      size: 1,
      mtime: '2026-01-02',
    };
    const dir = { path: 'r', entries: [], breadcrumbs: [], isInsider: true };
    expect(browse.parse(file)).toEqual(file);
    expect(browse.parse(dir)).toEqual(dir);
    expect(browse.safeParse({ path: 'r' }).success).toBe(false);
  });
});

describe('share query', () => {
  it('keeps every share parameter as a string on content entries', () => {
    const query = {
      exp: '1',
      d: '2',
      dirs: '1',
      s: 'abc',
      key: 'k',
      download: '1',
    };
    expect(SERVER_CATALOG.byName('raw').query.parse(query)).toEqual(query);
  });
});
