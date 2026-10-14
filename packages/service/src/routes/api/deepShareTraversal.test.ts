/**
 * Deep share traversal: deep keys are bound to one path; a directory
 * reached via a dirs=1 link lists only its immediate entries, each with
 * its own sub-key that consumes depth; nothing else is reachable.
 * Real middleware, directory route and HMAC keys over a temp tree.
 *
 * @packageDocumentation
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import * as cheerio from 'cheerio';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  INSIDER_SEED,
  makeRuntimeConfig,
  scopes,
} from '../../testing/authFixture.js';
import { computeDeepShareKey } from '../../util/crypto.js';

const SCOPED_SEED = 'scoped-insider-seed-0123456789';
const config = makeRuntimeConfig({
  extraInsiders: [
    {
      email: 'scoped@example.com',
      seed: SCOPED_SEED,
      scopes: scopes(['/r/docs/a.md', '/r/docs/sub']),
      keyCreatedAt: null,
    },
  ],
});

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'deep-share-'));
const tree = [
  'r/docs/a.md',
  'r/docs/x.md',
  'r/docs/sub/b.md',
  'r/docs/sub/deeper/c.md',
  'r/docsx/secret.md',
];
for (const rel of tree) {
  const file = path.join(tmpRoot, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `# ${rel}\n`);
}

vi.mock('../../config/index.js', () => ({
  getConfig: () => config,
  resetConfig: vi.fn(),
}));
vi.mock('../../util/platform.js', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getRoots: () => [],
  urlPathToFs: (urlPath: string) =>
    path.join(tmpRoot, ...urlPath.replace(/^\/+/u, '').split('/')),
  fsPathToUrl: (fsPath: string) =>
    '/' + path.relative(tmpRoot, fsPath).split(path.sep).join('/'),
  breadcrumbParts: () => [],
}));

const { addAuthMiddleware } = await import('./middleware.js');
const { directoryRoutes } = await import('./directory.js');
const { isDirectoryUrlPath } = await import('../../services/contentPath.js');
const { encodeStack, rewriteLinksForDeepShare } =
  await import('../../services/deepShareLinks.js');

let app: FastifyInstance;
const echo = (request: FastifyRequest) => ({
  accessMode: request.accessMode ?? null,
});

beforeAll(async () => {
  app = Fastify();
  await app.register(async (api) => {
    addAuthMiddleware(api);
    api.get('/api/file/*', echo);
    api.get('/api/raw/*', echo);
    api.get('/api/events', echo);
    api.get('/api/search', echo);
    await api.register(directoryRoutes);
  });
  await app.ready();
});

afterAll(async () => {
  await app.close();
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

const SHARED = '/r/docs/a.md';

/** Deep link query for `target` reached through `stack`. */
function deepQuery(
  target: string,
  stack: string[],
  depth: number,
  dirs: boolean,
  seed = INSIDER_SEED,
): string {
  const s = encodeStack(stack);
  const k = computeDeepShareKey(seed, target, { depth, dirs, stack: s });
  return `k=${k}&d=${String(depth)}&dirs=${dirs ? '1' : '0'}&s=${s}`;
}

interface Listing {
  entries: { name: string; shareUrl?: string | null }[];
}

const get = (url: string) => app.inject(url);

/** Content API URL for a share URL (the `/browse/` prefix becomes `/api/<route>/`). */
const apiUrl = (shareUrl: string, route: 'file' | 'path') =>
  shareUrl.replace(/^\/browse\//u, `/api/${route}/`);

describe('directory reached via a dirs=1 link', () => {
  const subQuery = deepQuery('/r/docs/sub', [SHARED, '/r/docs/sub'], 2, true);

  it('lists the directory with a sub-key per immediate entry', async () => {
    const res = await get(`/api/path/r/docs/sub?${subQuery}`);
    expect(res.statusCode).toBe(200);
    const { entries } = res.json<Listing>();
    expect(entries.map((e) => e.name).sort()).toEqual(['b.md', 'deeper']);
    for (const entry of entries) expect(typeof entry.shareUrl).toBe('string');
  });

  it.each([
    ['an entry with the directory key', '/api/file/r/docs/sub/b.md'],
    ['a grandchild with the directory key', '/api/file/r/docs/sub/deeper/c.md'],
    ['a sibling of the directory', '/api/file/r/docs/x.md'],
    ['the parent directory', '/api/path/r/docs'],
    ['a prefix sibling', '/api/file/r/docsx/secret.md'],
    ['raw bytes of an entry', '/api/raw/r/docs/sub/b.md'],
  ])('refuses %s', async (_label, url) => {
    expect((await get(`${url}?${subQuery}`)).statusCode).toBe(401);
  });

  it('opens an entry with its own sub-key', async () => {
    const { entries } = (
      await get(`/api/path/r/docs/sub?${subQuery}`)
    ).json<Listing>();
    const b = entries.find((e) => e.name === 'b.md');
    const res = await get(apiUrl(b?.shareUrl ?? '', 'file'));
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ accessMode: 'outsider' });
  });

  it('consumes depth per hop: a subdirectory listing at depth 0 has no links', async () => {
    const { entries } = (
      await get(`/api/path/r/docs/sub?${subQuery}`)
    ).json<Listing>();
    const deeper = entries.find((e) => e.name === 'deeper');
    const res = await get(apiUrl(deeper?.shareUrl ?? '', 'path'));
    expect(res.statusCode).toBe(200);
    const inner = res.json<Listing>().entries;
    expect(inner.map((e) => e.name)).toEqual(['c.md']);
    expect(inner[0]?.shareUrl).toBeNull();
  });

  it('has no entry links once depth is exhausted', async () => {
    const q = deepQuery('/r/docs/sub', [SHARED, '/r/docs/sub'], 1, true);
    const { entries } = (
      await get(`/api/path/r/docs/sub?${q}`)
    ).json<Listing>();
    expect(entries.every((e) => e.shareUrl === null)).toBe(true);
  });
});

describe('dirs=0', () => {
  it('refuses a directory reached by a hop', async () => {
    const q = deepQuery('/r/docs/sub', [SHARED, '/r/docs/sub'], 2, false);
    expect((await get(`/api/path/r/docs/sub?${q}`)).statusCode).toBe(401);
  });

  it('lists a shared directory but links no subdirectories', async () => {
    const q = deepQuery('/r/docs/sub', ['/r/docs/sub'], 2, false);
    const res = await get(`/api/path/r/docs/sub?${q}`);
    expect(res.statusCode).toBe(200);
    const byName = Object.fromEntries(
      res.json<Listing>().entries.map((e) => [e.name, e.shareUrl]),
    );
    expect(typeof byName['b.md']).toBe('string');
    expect(byName.deeper).toBeNull();
  });
});

describe('path handling', () => {
  const fileQuery = deepQuery(SHARED, [SHARED], 1, false);

  it('accepts a case variant of the shared path', async () => {
    expect((await get(`/api/file/R/Docs/A.md?${fileQuery}`)).statusCode).toBe(
      200,
    );
  });

  it('rejects traversal segments', async () => {
    expect(
      (await get(`/api/file/r/docs/sub/..%2Fx.md?${fileQuery}`)).statusCode,
    ).toBe(400);
  });

  it.each(['/api/events', '/api/search'])(
    'never authenticates the non-content route %s with a deep key',
    async (route) => {
      const q = deepQuery(route, [route], 1, true);
      expect((await get(`${route}?${q}`)).statusCode).toBe(401);
    },
  );

  it("checks the sharer's scopes against the requested path", async () => {
    const q = deepQuery(
      '/r/docs/x.md',
      [SHARED, '/r/docs/x.md'],
      2,
      true,
      SCOPED_SEED,
    );
    expect((await get(`/api/file/r/docs/x.md?${q}`)).statusCode).toBe(401);
  });
});

describe('slashless directory links in rendered documents', () => {
  const render = (dirs: boolean) =>
    cheerio.load(
      rewriteLinksForDeepShare(
        '<a href="sub">sub</a><a href="x.md">x</a>',
        INSIDER_SEED,
        SHARED,
        2,
        dirs,
        encodeStack([SHARED]),
        undefined,
        isDirectoryUrlPath,
      ),
      null,
      false,
    );

  it('detects the directory by stat and strips it without dirs', () => {
    const $ = render(false);
    expect($('a').length).toBe(1);
    expect($('a').attr('href')).toMatch(/^\/browse\/r\/docs\/x\.md\?/u);
  });

  it('links it with dirs, and the link lists the directory', async () => {
    const $ = render(true);
    const href = $('a').first().attr('href') ?? '';
    expect(href).toMatch(/^\/browse\/r\/docs\/sub\?/u);
    expect((await get(apiUrl(href, 'path'))).statusCode).toBe(200);
  });
});
