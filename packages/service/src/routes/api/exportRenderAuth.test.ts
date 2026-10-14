/**
 * #295: exports render with the server's `_internal` key once the caller is
 * authorised, whatever link they used, and a render that does not reach
 * `data-render-state="ready"` returns 502 and is never cached.
 *
 * @packageDocumentation
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import Fastify, { type FastifyInstance } from 'fastify';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  INSIDER_SEED,
  MACHINE_SEED,
  makeRuntimeConfig,
} from '../../testing/authFixture.js';
import {
  computeDeepShareKey,
  computeInsiderKey,
  computeOutsiderKeyWithExpiry,
} from '../../util/crypto.js';

const INTERNAL_KEY = computeInsiderKey('internal-seed-0123456789');
const config = makeRuntimeConfig({
  overrides: { internalInsiderKey: INTERNAL_KEY },
});
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'export-render-'));
const mdFile = path.join(tmpDir, 'a.md');
fs.writeFileSync(mdFile, '# A\n');

const exportPageMock = vi.hoisted(() => vi.fn());
const cacheExportMock = vi.hoisted(() => vi.fn());

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
vi.mock('../../services/exportCache.js', () => ({
  cacheExport: cacheExportMock,
  getCachedExport: () => null,
  clearExportCache: vi.fn(),
  clearDiagramCacheForFile: vi.fn(),
  clearStandaloneDiagramCache: vi.fn(),
}));
vi.mock('../../util/platform.js', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getRoots: () => [],
  urlPathToFs: () => mdFile,
}));

const { addAuthMiddleware } = await import('./middleware.js');
const { exportRoutes } = await import('./export.js');
const { RenderFailedError } = await import('../../services/puppeteer.js');
const { encodeStack } = await import('../../services/deepShareLinks.js');

let app: FastifyInstance;

beforeAll(async () => {
  app = Fastify();
  await app.register(async (api) => {
    addAuthMiddleware(api);
    await api.register(exportRoutes);
  });
  await app.ready();
});

afterEach(() => {
  exportPageMock.mockReset();
  cacheExportMock.mockReset();
});

afterAll(async () => {
  await app.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const DOC = '/r/docs/a.md';
const EXP = '4102444800000';
const stack = encodeStack([DOC]);

const deepQuery = (dirs: boolean) => {
  const key = computeDeepShareKey(INSIDER_SEED, DOC, {
    depth: 1,
    dirs,
    stack,
    exp: EXP,
  });
  return `k=${key}&d=1&dirs=${dirs ? '1' : '0'}&s=${stack}&exp=${EXP}`;
};

const links = [
  [
    'expiring link',
    `k=${computeOutsiderKeyWithExpiry(INSIDER_SEED, DOC, EXP)}&exp=${EXP}`,
  ],
  ['deep link', deepQuery(false)],
  ['deep link with dirs', deepQuery(true)],
  ['machine insider key', `k=${computeInsiderKey(MACHINE_SEED)}`],
] as const;

describe('export render auth (#295)', () => {
  it.each(links)(
    '%s: renders with the internal key and caches',
    async (_label, query) => {
      exportPageMock.mockResolvedValueOnce(Buffer.from('%PDF-doc'));

      const res = await app.inject(`/api/export${DOC}?format=pdf&${query}`);

      expect(res.statusCode).toBe(200);
      const [options] = exportPageMock.mock.calls[0] as [
        { url: string; authKey: string },
      ];
      expect(options.authKey).toBe(INTERNAL_KEY);
      const renderUrl = new URL(options.url);
      expect(renderUrl.pathname).toBe(`/browse${DOC}`);
      expect(renderUrl.searchParams.get('k')).toBe(INTERNAL_KEY);
      expect(cacheExportMock).toHaveBeenCalledTimes(1);
    },
  );

  it.each(['auth-required', 'error', 'timeout'] as const)(
    'a render ending in %s returns 502 and caches nothing',
    async (state) => {
      exportPageMock.mockRejectedValueOnce(new RenderFailedError(state));

      const res = await app.inject(
        `/api/export${DOC}?format=pdf&${links[0][1]}`,
      );

      expect(res.statusCode).toBe(502);
      expect(res.json<{ renderState: string }>().renderState).toBe(state);
      expect(cacheExportMock).not.toHaveBeenCalled();
    },
  );

  it('other export failures stay 500 and cache nothing', async () => {
    exportPageMock.mockRejectedValueOnce(new Error('chrome crashed'));

    const res = await app.inject(
      `/api/export${DOC}?format=docx&${links[0][1]}`,
    );

    expect(res.statusCode).toBe(500);
    expect(cacheExportMock).not.toHaveBeenCalled();
  });
});
