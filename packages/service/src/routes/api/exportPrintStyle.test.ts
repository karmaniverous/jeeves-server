/**
 * #316: print styles through the export route, against a real export cache
 * and real style files. A document's `jeeves.print` selects the style of
 * its PDF (never its DOCX), the response names it in `X-Print-Style` on a
 * render and on a cache hit, and an edited stylesheet is a cache miss.
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

import type { ResolvedPrintStyle } from '../../services/printStyles.js';
import { MACHINE_SEED, makeRuntimeConfig } from '../../testing/authFixture.js';
import { catalogRoutes } from '../../testing/catalogRoutes.js';
import { testApp } from '../../testing/testApp.js';
import { computeInsiderKey } from '../../util/crypto.js';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'export-print-style-'));
const docsDir = path.join(tmpDir, 'docs');
const mdFile = path.join(docsDir, 'a.md');
const cacheDir = path.join(tmpDir, 'cache');
const styleDir = path.join(tmpDir, 'styles');
const cssFile = path.join(styleDir, 'brief.css');

const config = makeRuntimeConfig({
  overrides: {
    internalInsiderKey: computeInsiderKey('internal-seed-316'),
    printStyles: {
      brief: { css: cssFile, page: { format: 'Letter' } },
      broken: { css: path.join(styleDir, 'missing.css') },
    },
  },
});

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

/** Write `a.md` with a front-matter `jeeves` block. */
const writeDoc = (jeeves: string) => {
  fs.writeFileSync(mdFile, `---\ntitle: A\n${jeeves}\n---\n# A\n`);
};

/** Export `a.md`; answers the body and `X-Print-Style`. */
const exportDoc = async (format = 'pdf') => {
  const res = await app.inject(
    `/api/export/r/docs/a.md?format=${format}&${KEY}`,
  );
  expect(res.statusCode).toBe(200);
  return { body: res.body, style: res.headers['x-print-style'] };
};

/** The print style the last render was given. */
const lastStyle = () =>
  (exportPageMock.mock.lastCall?.[0] as { printStyle?: ResolvedPrintStyle })
    .printStyle;

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
  for (const dir of [docsDir, cacheDir, styleDir]) {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(cssFile, 'h1 { color: navy !important; }');
  renders = 0;
  exportPageMock.mockReset();
  exportPageMock.mockImplementation(() =>
    Promise.resolve(Buffer.from(`render ${String(++renders)}`)),
  );
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterAll(async () => {
  await app.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('print styles through the export route (#316)', () => {
  it('renders a registered style and names it on a miss and a hit', async () => {
    writeDoc('jeeves:\n  print: brief');
    expect(await exportDoc()).toEqual({ body: 'render 1', style: 'brief' });
    expect(lastStyle()).toMatchObject({
      name: 'brief',
      css: 'h1 { color: navy !important; }',
      pdf: { format: 'letter', preferCSSPageSize: true },
    });
    expect(await exportDoc()).toEqual({ body: 'render 1', style: 'brief' });
    expect(exportPageMock).toHaveBeenCalledTimes(1);
  });

  it('renders afresh after the stylesheet is edited, without a restart', async () => {
    writeDoc('jeeves:\n  print: brief');
    expect((await exportDoc()).body).toBe('render 1');
    fs.writeFileSync(cssFile, 'h1 { color: maroon !important; }');
    expect(await exportDoc()).toEqual({ body: 'render 2', style: 'brief' });
    expect(lastStyle()?.css).toBe('h1 { color: maroon !important; }');
  });

  it('answers default without a directive, on a miss and a hit', async () => {
    writeDoc('author: x');
    expect(await exportDoc()).toEqual({ body: 'render 1', style: 'default' });
    expect(lastStyle()?.name).toBe('default');
    expect(lastStyle()?.css).toBeUndefined();
    expect(await exportDoc()).toEqual({ body: 'render 1', style: 'default' });
  });

  it.each([
    ['an unregistered name', 'nope'],
    ['a path', '../styles/brief.css'],
    ['a URL', 'https://example.com/x.css'],
    ['a non-string', '[brief]'],
    ['a style that fails to load', 'broken'],
  ])('falls back to default for %s', async (_kind, value) => {
    writeDoc(`jeeves:\n  print: ${value}`);
    expect(await exportDoc()).toEqual({ body: 'render 1', style: 'default' });
    expect(lastStyle()?.css).toBeUndefined();
  });

  it('ignores the style for DOCX', async () => {
    writeDoc('jeeves:\n  print: brief');
    const res = await exportDoc('docx');
    expect(res).toEqual({ body: 'render 1', style: undefined });
    expect(lastStyle()).toBeUndefined();
  });
});
