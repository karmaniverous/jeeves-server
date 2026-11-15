/**
 * #288: the export route against a real export cache. An unchanged document
 * is served from the cache; a changed document or referenced image renders
 * afresh; Clear Cache on the file or its directory forces a new render.
 *
 * @packageDocumentation
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { type FastifyInstance } from 'fastify';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { MACHINE_SEED, makeRuntimeConfig } from '../../testing/authFixture.js';
import { catalogRoutes } from '../../testing/catalogRoutes.js';
import { testApp } from '../../testing/testApp.js';
import { computeInsiderKey } from '../../util/crypto.js';

const config = makeRuntimeConfig({
  overrides: { internalInsiderKey: computeInsiderKey('internal-seed-288') },
});
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'export-cache-route-'));
const docsDir = path.join(tmpDir, 'docs');
const mdFile = path.join(docsDir, 'a.md');
const imageFile = path.join(docsDir, 'chart.png');
const cacheDir = path.join(tmpDir, 'cache');

const exportPageMock = vi.hoisted(() => vi.fn());

vi.mock('../../config/index.js', () => ({
  getConfig: () => config,
  resetConfig: vi.fn(),
}));
vi.mock('@karmaniverous/jeeves', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getBindAddress: () => '127.0.0.1',
}));
vi.mock('../../services/eventQueue.js', () => ({ appendEvent: vi.fn() }));
vi.mock('../../services/export.js', () => ({ exportPage: exportPageMock }));
vi.mock('../../util/platform.js', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getRoots: () => [],
  urlPathToFs: (urlPath: string) =>
    path.join(tmpDir, urlPath.replace(/^\/?r\/?/, '')),
}));

const { addAccessHook } = await import('../../api/accessHook.js');
const { exportHandlers } = await import('./export.js');
const { initExportCache } = await import('../../services/exportCache.js');

const KEY = `k=${computeInsiderKey(MACHINE_SEED)}`;
let app: FastifyInstance;
let renders = 0;

/** Export `a.md`; answers the body. */
const exportDoc = async (format = 'pdf') => {
  const res = await app.inject(
    `/api/export/r/docs/a.md?format=${format}&${KEY}`,
  );
  expect(res.statusCode).toBe(200);
  return res.body;
};

const clear = async (urlPath: string) => {
  const res = await app.inject({
    method: 'DELETE',
    url: `/api/export-cache/${urlPath}?${KEY}`,
  });
  expect(res.statusCode).toBe(200);
  return res.json<{ cleared: { exports: number } }>().cleared.exports;
};

beforeAll(async () => {
  initExportCache(cacheDir);
  app = testApp();
  await app.register(async (api) => {
    addAccessHook(api);
    await api.register(catalogRoutes(exportHandlers));
  });
  await app.ready();
});

beforeEach(() => {
  fs.rmSync(docsDir, { recursive: true, force: true });
  fs.rmSync(cacheDir, { recursive: true, force: true });
  fs.mkdirSync(docsDir, { recursive: true });
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(mdFile, '# A\n\n![chart](chart.png)\n');
  fs.writeFileSync(imageFile, 'png');
  renders = 0;
  exportPageMock.mockReset();
  exportPageMock.mockImplementation(() =>
    Promise.resolve(Buffer.from(`render ${String(++renders)}`)),
  );
});

afterAll(async () => {
  await app.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('export cache through the export route (#288)', () => {
  it('serves an unchanged document from the cache', async () => {
    expect(await exportDoc()).toBe('render 1');
    expect(await exportDoc()).toBe('render 1');
    expect(exportPageMock).toHaveBeenCalledTimes(1);
  });

  it('caches each format separately', async () => {
    expect(await exportDoc('pdf')).toBe('render 1');
    expect(await exportDoc('docx')).toBe('render 2');
    expect(await exportDoc('pdf')).toBe('render 1');
  });

  it('renders afresh when the document changes', async () => {
    await exportDoc();
    fs.appendFileSync(mdFile, '\nMore.\n');
    expect(await exportDoc()).toBe('render 2');
  });

  it('renders afresh when a referenced image changes', async () => {
    await exportDoc();
    fs.writeFileSync(imageFile, 'a bigger png');
    expect(await exportDoc()).toBe('render 2');
  });

  it('renders afresh after clearing the file', async () => {
    await exportDoc();
    await exportDoc('docx');
    expect(await clear('r/docs/a.md')).toBe(2);
    expect(await exportDoc()).toBe('render 3');
  });

  it('renders afresh after clearing its directory', async () => {
    await exportDoc();
    expect(await clear('r/docs')).toBe(1);
    expect(await exportDoc()).toBe('render 2');
  });
});
