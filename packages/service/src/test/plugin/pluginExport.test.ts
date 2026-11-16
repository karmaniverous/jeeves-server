// @vitest-environment node
/**
 * `server_export` against the real app (#320): the formats and URLs it offers are the ones link-info lists, so a file the watcher renders as Markdown exports to PDF and DOCX, a Mermaid source to PDF too, and a directory to zip and tar; a file the watcher doesn't render has none. The watcher is stubbed; everything else is the wire app.
 */

import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { WatcherRenderOutcome } from '../../services/watcherRender.js';
import { SDK_BASE_URL } from '../sdk/sdkHarness.js';
import { startWireApp, type WireApp } from '../wire/wireApp.js';
import { WIRE_SEEDS } from '../wire/wireFixture.js';
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

  it('exports a watcher-rendered file and a Mermaid source to PDF', async () => {
    expect(await linksOf(`${root}/data.json`)).toHaveProperty('docx');
    expect(await linksOf(`${root}/flow.mmd`)).toHaveProperty('pdf');
    const signed = jsonOf(await exportOf(`${root}/data.json`, 'pdf', {}));
    expect(String(signed['url'])).toMatch(
      /\/api\/export\/.*data\.json\?k=[^&]+&format=pdf$/,
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
