// @vitest-environment node
/**
 * `server_export` against the real app (#320): the formats and URLs it offers are the ones link-info lists, so a file the watcher renders as Markdown exports to PDF and DOCX, a Mermaid source to PDF too, and a directory to zip and tar; a file the watcher doesn't render has none. The watcher is stubbed and the watcher-rendered PDF is seeded in the export cache (no Chrome); everything else is the wire app.
 */

import path from 'node:path';

import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { getConfig } from '../../config/index.js';
import { cacheExport } from '../../services/exportCache.js';
import {
  DEFAULT_PRINT_STYLE,
  documentExportKey,
} from '../../services/exportCacheKey.js';
import { loadMarkdownDocument } from '../../services/markdownDocument.js';
import { resolvePrintStyle } from '../../services/printStyles.js';
import type { WatcherRenderOutcome } from '../../services/watcherRender.js';
import { getRoots } from '../../util/platform.js';
import { SDK_BASE_URL } from '../sdk/sdkHarness.js';
import { startWireApp, type WireApp } from '../wire/wireApp.js';
import { CACHED_EXPORT, WIRE_SEEDS } from '../wire/wireFixture.js';
import {
  jsonOf,
  pluginTools,
  routePluginFetch,
  runTool,
  statusOf,
} from './pluginHarness.js';

const renderViaWatcher = vi.hoisted(() =>
  vi.fn<(fsPath: string) => Promise<WatcherRenderOutcome>>(),
);
vi.mock('../../services/watcherRender.js', () => ({ renderViaWatcher }));

/** The watcher renders `data.json` as Markdown, and nothing else. */
const renderJson = (fsPath: string): Promise<WatcherRenderOutcome> =>
  Promise.resolve(
    fsPath.endsWith('data.json')
      ? {
          status: 'rendered',
          data: {
            renderAs: 'md',
            content: '# a\n',
            rules: ['r'],
            metadata: {},
          },
        }
      : { status: 'none' },
  );

let wire: WireApp;
let root: string;
const tools = () => pluginTools(WIRE_SEEDS.primary);

/** `server_export`'s result for a path in a format. */
const exportOf = (path: string, format: string, share?: object) =>
  runTool(tools(), 'server_export', {
    path,
    format,
    ...(share ? { share } : {}),
  });

/** The formats and absolute URLs link-info lists for a path. */
async function linksOf(path: string): Promise<Record<string, string>> {
  const info = jsonOf(await runTool(tools(), 'server_link_info', { path }));
  const links = info['exportLinks'] as { format: string; url: string }[];
  return Object.fromEntries(
    links.map(({ format, url }) => [
      format,
      new URL(url, SDK_BASE_URL).toString(),
    ]),
  );
}

/**
 * Seed the export cache with a PDF of the watcher-rendered `data.json`, under
 * the key the export route computes, as the wire seeds do for `doc.md`.
 */
async function seedDataPdf(): Promise<void> {
  const fsPath = path.join(wire.contentDir, 'data.json');
  const doc = await loadMarkdownDocument(fsPath);
  if (!doc) throw new Error('data.json did not load as Markdown');
  cacheExport({
    fsPath,
    key: documentExportKey(fsPath, doc, 'pdf', {
      roots: getRoots(getConfig().roots),
      style: resolvePrintStyle(doc.directives, fsPath),
    }),
    format: 'pdf',
    buffer: CACHED_EXPORT,
    printStyle: DEFAULT_PRINT_STYLE.name,
  });
}

beforeAll(async () => {
  wire = await startWireApp();
  root = wire.rootUrl.slice(1);
  routePluginFetch(wire);
  vi.stubEnv('JEEVES_CONFIG_ROOT', '');
});

beforeEach(() => {
  wire.reset();
  renderViaWatcher.mockReset();
  renderViaWatcher.mockImplementation(renderJson);
});

afterAll(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  await wire.close();
});

describe('server_export on the real app', () => {
  it.each(['data.json', 'flow.mmd', 'seq.puml'])(
    '%s: offers exactly the formats link-info lists, at its URLs',
    async (name) => {
      const path = `${root}/${name}`;
      const links = await linksOf(path);
      expect(Object.keys(links).length).toBeGreaterThan(0);
      for (const [format, url] of Object.entries(links)) {
        if (!['pdf', 'docx', 'svg', 'png'].includes(format)) continue;
        expect(jsonOf(await exportOf(path, format))['url']).toBe(url);
      }
    },
  );

  it('a share-signed PDF of a watcher-rendered file opens without a session', async () => {
    await seedDataPdf();
    const url = String(
      jsonOf(await exportOf(`${root}/data.json`, 'pdf', {}))['url'],
    );
    expect(url).toMatch(/\/api\/export\/.*data\.json\?k=[^&]+&format=pdf$/);
    expect(await statusOf(wire, url)).toBe(200);
  });

  it('exports a Mermaid source to PDF on the Mermaid route', async () => {
    expect(jsonOf(await exportOf(`${root}/flow.mmd`, 'pdf'))['url']).toBe(
      `${SDK_BASE_URL}/api/mermaid-export/${root}/flow.mmd?format=pdf`,
    );
  });

  it('refuses a file the watcher does not render, naming why', async () => {
    renderViaWatcher.mockResolvedValue({ status: 'none' });
    const result = await exportOf(`${root}/data.json`, 'pdf');
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('watcher renders as Markdown');
  });

  it.each(['zip', 'tar'])(
    'archives a directory as %s, insider-only',
    async (format) => {
      const url = String(
        jsonOf(await exportOf(`${root}/sub dir`, format))['url'],
      );
      expect(url).toBe(
        `${SDK_BASE_URL}/api/export/${root}/sub%20dir?format=${format}`,
      );
      expect(await statusOf(wire, url, true)).toBe(200);
      const shared = await exportOf(`${root}/sub dir`, format, {});
      expect(shared.content[0]?.text).toContain('archives are insider-only');
    },
  );
});
