/**
 * The file API, export and link-info agree on what a Markdown document is
 * (#284, #316): for native `.md`/`.markdown`, watcher `md`, watcher
 * non-md, unrendered and watcher-down files, the file view's type, the
 * PDF/DOCX export reply and the advertised export links match. Real files
 * and the real loader; the watcher, Chrome and the export cache are mocked.
 *
 * @packageDocumentation
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type * as JeevesModule from '@karmaniverous/jeeves';
import type { FastifyError } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { WatcherRenderOutcome } from '../../services/watcherRender.js';

let tmpDir = '';

vi.mock('@karmaniverous/jeeves', async (importOriginal) => ({
  ...(await importOriginal<typeof JeevesModule>()),
  getBindAddress: () => '127.0.0.1',
}));
vi.mock('../../config/index.js', () => ({
  getConfig: () => ({ roots: {}, port: 1934, internalInsiderKey: 'k' }),
}));
vi.mock('../../util/platform.js', () => ({
  getRoots: () => ({}),
  urlPathToFs: (reqPath: string) =>
    path.join(tmpDir, ...reqPath.split('/').slice(1)),
  breadcrumbParts: () => [],
}));
const renderViaWatcher = vi.hoisted(() =>
  vi.fn<(p: string) => Promise<WatcherRenderOutcome>>(),
);
vi.mock('../../services/watcherRender.js', () => ({ renderViaWatcher }));
const exportPage = vi.hoisted(() => vi.fn());
vi.mock('../../services/export.js', () => ({ exportPage }));
const cacheExport = vi.hoisted(() => vi.fn());
vi.mock('../../services/exportCache.js', () => ({
  cacheExport,
  getCachedExport: () => null,
  registerDiagramHashes: vi.fn(),
}));
vi.mock('../../services/eventQueue.js', () => ({ appendEvent: vi.fn() }));

const { fileContentHandlers } = await import('./fileContent.js');
const { exportHandlers } = await import('./export.js');
const { linkInfoHandlers } = await import('./linkInfo.js');

const request = { accessMode: 'insider', query: {} } as never;
const md = (content: string): WatcherRenderOutcome => ({
  status: 'rendered',
  data: { renderAs: 'md', content, rules: ['r'], metadata: {} },
});

/** What each consumer says about a file. */
async function views(name: string) {
  const reqPath = `j/${name}`;
  const params = { '*': reqPath };
  const file = await fileContentHandlers.fileContent(
    { params, query: {}, body: {} },
    request,
  );
  const exported = await Promise.all(
    (['pdf', 'docx'] as const).map((format) =>
      exportHandlers
        .export({ params, query: { format }, body: {} }, request)
        .then(
          (r) => ({
            status: 200,
            disposition: (r.headers as Record<string, string>)[
              'content-disposition'
            ],
          }),
          (e: unknown) => {
            const { statusCode, code } = e as FastifyError;
            return { status: statusCode, code };
          },
        ),
    ),
  );
  const links = await linkInfoHandlers.linkInfo(
    { params, query: {}, body: {} },
    request,
  );
  return {
    type: (file.body as { type: string }).type,
    exported,
    formats: (
      links.body as { exportLinks?: { format: string }[] }
    ).exportLinks?.map((l) => l.format),
  };
}

describe('Markdown documents: file API, export and link-info agree', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jeeves-agree-'));
    renderViaWatcher.mockReset().mockResolvedValue({ status: 'none' });
    exportPage.mockReset().mockResolvedValue(Buffer.from('%PDF'));
    cacheExport.mockReset();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it.each([
    ['a.md', 'a'],
    ['notes.markdown', 'notes'],
  ])('native %s: markdown, exported, advertised', async (name, base) => {
    fs.writeFileSync(path.join(tmpDir, name), '# Doc\n');
    expect(await views(name)).toEqual({
      type: 'markdown',
      exported: [
        { status: 200, disposition: `attachment; filename="${base}.pdf"` },
        { status: 200, disposition: `attachment; filename="${base}.docx"` },
      ],
      formats: ['pdf', 'docx'],
    });
    expect(renderViaWatcher).not.toHaveBeenCalled();
  });

  it("watcher renderAs 'md': markdown, exported, advertised", async () => {
    fs.writeFileSync(path.join(tmpDir, 'industry.json'), '{}');
    renderViaWatcher.mockResolvedValue(md('# Brief\n'));
    expect(await views('industry.json')).toEqual({
      type: 'markdown',
      exported: [
        { status: 200, disposition: 'attachment; filename="industry.pdf"' },
        { status: 200, disposition: 'attachment; filename="industry.docx"' },
      ],
      formats: ['pdf', 'docx'],
    });
    expect(cacheExport).toHaveBeenCalledTimes(2);
  });

  const unsupported = { status: 400, code: 'SERVER_EXPORT_UNSUPPORTED' };
  it.each<[string, WatcherRenderOutcome]>([
    [
      'watcher non-md',
      {
        status: 'rendered',
        data: { renderAs: 'html', content: '<p/>', rules: ['r'], metadata: {} },
      },
    ],
    ['unrendered', { status: 'none' }],
  ])('%s: text, 400, not advertised', async (_kind, outcome) => {
    fs.writeFileSync(path.join(tmpDir, 'x.json'), '{}');
    renderViaWatcher.mockResolvedValue(outcome);
    expect(await views('x.json')).toEqual({
      type: 'text',
      exported: [unsupported, unsupported],
      formats: [],
    });
    expect(exportPage).not.toHaveBeenCalled();
  });

  it('watcher down: text, 502 with nothing cached, not advertised', async () => {
    fs.writeFileSync(path.join(tmpDir, 'x.json'), '{}');
    renderViaWatcher.mockResolvedValue({
      status: 'unreachable',
      error: new Error('down'),
    });
    const down = { status: 502, code: 'SERVER_WATCHER_UNAVAILABLE' };
    expect(await views('x.json')).toEqual({
      type: 'text',
      exported: [down, down],
      formats: [],
    });
    expect(exportPage).not.toHaveBeenCalled();
    expect(cacheExport).not.toHaveBeenCalled();
  });
});
