/**
 * Directory shares from `POST /api/share` and `share-for`: without depth or
 * dirs they are tree shares (a plain path key opens anything below the
 * directory); with depth they are deep shares, which list only immediate
 * entries, each with its own sub-key. Real middleware, sharing and
 * directory routes and HMAC keys over a temp tree.
 *
 * @packageDocumentation
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { MACHINE_SEED, makeRuntimeConfig } from '../../testing/authFixture.js';
import { computeInsiderKey } from '../../util/crypto.js';

const config = makeRuntimeConfig();

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dir-share-'));
for (const rel of [
  'r/docs/a.md',
  'r/docs/sub/b.md',
  'r/docs/sub/deeper/c.md',
  'r/other.md',
]) {
  const file = path.join(tmpRoot, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `# ${rel}\n`);
}

vi.mock('../../config/index.js', () => ({
  getConfig: () => config,
  resetConfig: vi.fn(),
}));
vi.mock('../../util/configPersist.js', () => ({
  writeInsiderSeedToConfig: vi.fn(),
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
const { sharingRoutes } = await import('./sharing.js');

let app: FastifyInstance;

beforeAll(async () => {
  app = Fastify();
  await app.register(async (api) => {
    addAuthMiddleware(api);
    api.get('/api/file/*', (request: FastifyRequest) => ({
      accessMode: request.accessMode ?? null,
    }));
    await api.register(directoryRoutes);
    await api.register(sharingRoutes);
  });
  await app.ready();
});

afterAll(async () => {
  await app.close();
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

const DIR = '/r/docs';
const machineKey = computeInsiderKey(MACHINE_SEED);

interface Listing {
  entries: { name: string; shareUrl?: string | null }[];
}

/** Share `DIR` via `POST /api/share`; returns the share URL's query. */
async function share(body: Record<string, unknown>): Promise<URL> {
  const res = await app.inject({
    method: 'POST',
    url: `/api/share?k=${machineKey}`,
    payload: { path: DIR, ...body },
  });
  expect(res.statusCode).toBe(200);
  return new URL(res.json<{ url: string }>().url, 'http://relative.invalid');
}

/** Share `DIR` with an outsider via `share-for`. */
async function shareFor(body: Record<string, unknown>): Promise<URL> {
  const res = await app.inject({
    method: 'POST',
    url: `/api/util/share-for?k=${machineKey}`,
    payload: { path: DIR, insiders: ['outsider@example.com'], ...body },
  });
  expect(res.statusCode).toBe(200);
  const json = res.json<{ url: string; type: string }>();
  expect(json.type).toBe('outsider-share');
  return new URL(json.url, 'http://relative.invalid');
}

/** Content API URL for a share URL (`/browse/` becomes `/api/<route>/`). */
const apiUrl = (shareUrl: string, route: 'file' | 'path') =>
  shareUrl.replace(/^\/browse\//u, `/api/${route}/`);

describe.each([
  ['POST /api/share', share],
  ['share-for', shareFor],
])('%s: plain directory share (no depth, no dirs)', (_label, create) => {
  it('issues a plain path key (no deep parameters)', async () => {
    const url = await create({});
    expect(url.pathname).toBe(`/browse${DIR}`);
    expect([...url.searchParams.keys()]).toEqual(['k']);
  });

  it('opens a grandchild file', async () => {
    const url = await create({});
    const res = await app.inject(
      `/api/file/r/docs/sub/deeper/c.md${url.search}`,
    );
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ accessMode: 'outsider' });
  });

  it('lists the directory and opens an entry', async () => {
    const url = await create({});
    const listing = await app.inject(`/api/path${DIR}${url.search}`);
    expect(listing.statusCode).toBe(200);
    const names = listing.json<Listing>().entries.map((e) => e.name);
    expect(names).toContain('a.md');
    const res = await app.inject(`/api/file/r/docs/a.md${url.search}`);
    expect(res.statusCode).toBe(200);
  });

  it('does not open anything outside the directory', async () => {
    const url = await create({});
    const res = await app.inject(`/api/file/r/other.md${url.search}`);
    expect(res.statusCode).toBe(401);
  });
});

describe.each([
  ['POST /api/share', share],
  ['share-for', shareFor],
])('%s: deep directory share with depth', (_label, create) => {
  it('issues a deep key', async () => {
    const url = await create({ depth: 2 });
    expect(url.searchParams.get('d')).toBe('2');
  });

  it('lists only immediate entries, each with its own sub-key', async () => {
    const url = await create({ depth: 2 });
    const res = await app.inject(`/api/path${DIR}${url.search}`);
    expect(res.statusCode).toBe(200);
    const { entries } = res.json<Listing>();
    expect(entries.map((e) => e.name).sort()).toEqual(['a.md', 'sub']);
    const a = entries.find((e) => e.name === 'a.md');
    expect(typeof a?.shareUrl).toBe('string');
    const opened = await app.inject(apiUrl(a?.shareUrl ?? '', 'file'));
    expect(opened.statusCode).toBe(200);
  });

  it.each([
    ['an entry', '/api/file/r/docs/a.md'],
    ['a grandchild', '/api/file/r/docs/sub/deeper/c.md'],
    ['the parent directory', '/api/path/r'],
    ['a sibling', '/api/file/r/other.md'],
  ])('refuses %s with the directory key', async (_l, target) => {
    const url = await create({ depth: 2 });
    expect((await app.inject(`${target}${url.search}`)).statusCode).toBe(401);
  });
});
