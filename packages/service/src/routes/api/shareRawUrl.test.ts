/**
 * `POST /api/share` reports whether the target is a directory, and a file
 * share's raw URL (the page URL with `/browse/` swapped for `/api/raw/`,
 * query unchanged, as the plugin's `server_share` builds it) authenticates
 * on the raw route for that one file only. Real middleware, sharing and raw
 * routes and HMAC keys over a temp tree.
 *
 * @packageDocumentation
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { MACHINE_SEED, makeRuntimeConfig } from '../../testing/authFixture.js';
import { computeInsiderKey } from '../../util/crypto.js';

const config = makeRuntimeConfig();

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'share-raw-'));
for (const rel of ['r/docs/a.md', 'r/docs/sibling.md', 'r/docs/sub/b.md']) {
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
}));

const { addAuthMiddleware } = await import('./middleware.js');
const { rawRoutes } = await import('./raw.js');
const { sharingRoutes } = await import('./sharing.js');

let app: FastifyInstance;

beforeAll(async () => {
  app = Fastify();
  await app.register(async (api) => {
    addAuthMiddleware(api);
    await api.register(rawRoutes);
    await api.register(sharingRoutes);
  });
  await app.ready();
});

afterAll(async () => {
  await app.close();
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

const FILE = '/r/docs/a.md';
const machineKey = computeInsiderKey(MACHINE_SEED);

interface Share {
  url: string;
  isDirectory: boolean;
}

/** Share `target` via `POST /api/share`. */
async function share(
  target: string,
  body: Record<string, unknown> = {},
): Promise<Share> {
  const res = await app.inject({
    method: 'POST',
    url: `/api/share?k=${machineKey}`,
    payload: { path: target, ...body },
  });
  expect(res.statusCode).toBe(200);
  return res.json<Share>();
}

/** The raw URL for a share URL, as `server_share` derives it. */
const rawUrl = (shareUrl: string) =>
  shareUrl.replace(/^\/browse\//u, '/api/raw/');

const FILE_SHARES = [
  ['plain', {}],
  ['plain expiring', { expiry: '4102444800000' }],
  ['deep', { depth: 2 }],
  ['deep with dirs', { depth: 1, dirs: true }],
  ['deep expiring', { depth: 2, expiry: '4102444800000' }],
] as const;

describe('file shares: the raw URL works for that file only', () => {
  it.each(FILE_SHARES)('%s: reports a file', async (_label, body) => {
    expect((await share(FILE, body)).isDirectory).toBe(false);
  });

  it.each(FILE_SHARES)(
    '%s: raw URL returns the file (200)',
    async (_label, body) => {
      const res = await app.inject(rawUrl((await share(FILE, body)).url));
      expect(res.statusCode).toBe(200);
      expect(res.body).toBe('# r/docs/a.md\n');
    },
  );

  it.each(FILE_SHARES)(
    "%s: the raw URL's query does not open a sibling file",
    async (_label, body) => {
      const { search } = new URL(
        (await share(FILE, body)).url,
        'http://relative.invalid',
      );
      const res = await app.inject(`/api/raw/r/docs/sibling.md${search}`);
      expect(res.statusCode).toBe(401);
    },
  );

  it('a deep raw URL does not open the parent directory or a child path', async () => {
    const { search } = new URL(
      (await share(FILE, { depth: 2 })).url,
      'http://relative.invalid',
    );
    expect(
      (await app.inject(`/api/raw/r/docs/sub/b.md${search}`)).statusCode,
    ).toBe(401);
    expect((await app.inject(`/api/raw/r/docs${search}`)).statusCode).toBe(401);
  });
});

describe('directory shares', () => {
  it.each([
    ['plain', {}],
    ['deep', { depth: 1, dirs: true }],
  ])('%s: reports a directory', async (_label, body) => {
    expect((await share('/r/docs', body)).isDirectory).toBe(true);
  });

  it('reports a missing path as not a directory', async () => {
    expect((await share('/r/missing.md')).isDirectory).toBe(false);
  });
});
