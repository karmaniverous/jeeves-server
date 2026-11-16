/**
 * `server_export` on the SDK: export URLs in the formats and on the routes link-info lists for the path (#320), unkeyed or from a signed share, never carrying the plugin key (Decisions 19 and 21).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  BASE_URL,
  fakeServer,
  jsonOf,
  PLUGIN_KEY,
  pluginTools,
  type RecordedRequest,
  type Reply,
  runTool,
  shareReply,
  textOf,
} from './test/fakeServer.js';

const NOW = 1_700_000_000_000;

beforeEach(() => {
  vi.stubEnv('JEEVES_CONFIG_ROOT', '');
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

/**
 * A `linkInfo` reply offering `formats` on `route`, as the server lists
 * export links (`<route><path>?format=<format>`).
 */
const linkInfo =
  (isDirectory: boolean, route = '/api/export/', formats: string[] = []) =>
  (req: RecordedRequest): Reply => {
    const path = req.url.pathname.slice('/api/link-info/'.length);
    return {
      body: {
        exists: true,
        isDirectory,
        pageUrl: `/browse/${path}`,
        exportLinks: formats.map((format) => ({
          format,
          url: `${route}${path}?format=${format}`,
        })),
      },
    };
  };

/** Link-info of a Markdown document (native or watcher-rendered). */
const documentInfo = linkInfo(false, '/api/export/', ['pdf', 'docx']);

/** Link-info of a directory, as an insider sees it. */
const directoryInfo = linkInfo(true, '/api/export/', ['zip']);

/** Link-info of a Mermaid source. */
const mermaidInfo = linkInfo(false, '/api/mermaid-export/', [
  'svg',
  'png',
  'pdf',
]);

/** Link-info of a PlantUML source with a jar configured (svg, png, pdf, eps). */
const plantUmlInfo = linkInfo(false, '/api/plantuml-export/', [
  'svg',
  'png',
  'pdf',
  'eps',
]);

describe('server_export', () => {
  it.each([
    ['j/a.md', 'pdf', documentInfo, '/api/export/j/a.md?format=pdf'],
    [
      'j/a.markdown',
      'docx',
      documentInfo,
      '/api/export/j/a.markdown?format=docx',
    ],
    [
      'j/run/brief.json',
      'pdf',
      documentInfo,
      '/api/export/j/run/brief.json?format=pdf',
    ],
    [
      'j/run/brief.json',
      'docx',
      documentInfo,
      '/api/export/j/run/brief.json?format=docx',
    ],
    [
      'j/my notes.md',
      'pdf',
      documentInfo,
      '/api/export/j/my%20notes.md?format=pdf',
    ],
    [
      'j/browse/a.md',
      'pdf',
      documentInfo,
      '/api/export/j/browse/a.md?format=pdf',
    ],
    ['j/docs', 'zip', directoryInfo, '/api/export/j/docs?format=zip'],
    ['j/docs', 'tar', directoryInfo, '/api/export/j/docs?format=tar'],
    ['j/d.mmd', 'svg', mermaidInfo, '/api/mermaid-export/j/d.mmd?format=svg'],
    ['j/d.mmd', 'pdf', mermaidInfo, '/api/mermaid-export/j/d.mmd?format=pdf'],
    [
      'j/d.puml',
      'png',
      plantUmlInfo,
      '/api/plantuml-export/j/d.puml?format=png',
    ],
    [
      'j/d.plantuml',
      'pdf',
      plantUmlInfo,
      '/api/plantuml-export/j/d.plantuml?format=pdf',
    ],
  ])(
    '%s as %s: an unkeyed URL on the route link-info names',
    async (path, format, info, url) => {
      const requests = fakeServer({
        [`GET /api/link-info/${encodeURI(path)}`]: info,
      });
      const result = await runTool(pluginTools(), 'server_export', {
        path,
        format,
      });
      expect(jsonOf(result)).toEqual({ path, format, url: BASE_URL + url });
      expect(requests).toHaveLength(1);
    },
  );

  it.each([
    ['j/a.md', 'zip', documentInfo, 'use pdf, docx'],
    ['j/docs', 'pdf', directoryInfo, 'use zip, tar'],
    ['j/d.mmd', 'docx', mermaidInfo, 'use svg, png, pdf'],
    [
      'j/d.puml',
      'png',
      linkInfo(false, '/api/plantuml-export/', ['svg']),
      'use svg',
    ],
  ])(
    '%s as %s is an error naming the formats link-info lists',
    async (path, format, info, valid) => {
      fakeServer({ [`GET /api/link-info/${path}`]: info });
      const result = await runTool(pluginTools(), 'server_export', {
        path,
        format,
      });
      expect(result.isError).toBe(true);
      expect(textOf(result)).toContain(`Format "${format}"`);
      expect(textOf(result)).toContain(valid);
    },
  );

  it('never offers eps, which link-info lists with a PlantUML jar', async () => {
    fakeServer({ 'GET /api/link-info/j/d.puml': plantUmlInfo });
    const result = await runTool(pluginTools(), 'server_export', {
      path: 'j/d.puml',
      format: 'eps',
    });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/; use svg, png, pdf$/);
  });

  it('reports a path with no export formats, and a missing path', async () => {
    fakeServer({
      'GET /api/link-info/j/a.json': linkInfo(false),
      'GET /api/link-info/j/docs': linkInfo(true),
      'GET /api/link-info/j/none.md': { body: { exists: false } },
    });
    const tools = pluginTools();
    const json = await runTool(tools, 'server_export', {
      path: 'j/a.json',
      format: 'pdf',
    });
    expect(json.isError).toBe(true);
    expect(textOf(json)).toContain('j/a.json has no export formats');
    expect(textOf(json)).toContain('the watcher renders as Markdown');
    const dir = await runTool(tools, 'server_export', {
      path: 'j/docs',
      format: 'zip',
    });
    expect(textOf(dir)).toContain('to insiders only');
    const missing = await runTool(tools, 'server_export', {
      path: 'j/none.md',
      format: 'pdf',
    });
    expect(textOf(missing)).toBe('Error: Not found: j/none.md');
  });

  it('with share, derives the URL from a signed share', async () => {
    const requests = fakeServer({
      'GET /api/link-info/j/a.md': documentInfo,
      'POST /api/share': shareReply(false),
    });
    const result = await runTool(pluginTools(), 'server_export', {
      path: 'j/a.md',
      format: 'docx',
      share: { expiryDays: 1 },
    });
    const exp = String(NOW + 86_400_000);
    expect(requests[1]?.body).toEqual({ path: '/j/a.md', expiry: exp });
    expect(jsonOf(result)).toEqual({
      path: 'j/a.md',
      format: 'docx',
      url: `${BASE_URL}/api/export/j/a.md?k=out&exp=${exp}&format=docx`,
      exp,
    });
  });

  it('with share, a Mermaid pdf is on the Mermaid route', async () => {
    fakeServer({
      'GET /api/link-info/j/d.mmd': mermaidInfo,
      'POST /api/share': shareReply(false),
    });
    const result = await runTool(pluginTools(), 'server_export', {
      path: 'j/d.mmd',
      format: 'pdf',
      share: {},
    });
    expect(jsonOf(result)).toMatchObject({
      url: `${BASE_URL}/api/mermaid-export/j/d.mmd?k=out&format=pdf`,
    });
  });

  it.each(['zip', 'tar'])(
    'with share, a directory %s is an error and signs nothing (archives are insider-only)',
    async (format) => {
      const requests = fakeServer({
        'GET /api/link-info/j/docs': directoryInfo,
        'POST /api/share': shareReply(true),
      });
      const result = await runTool(pluginTools(), 'server_export', {
        path: 'j/docs',
        format,
        share: {},
      });
      expect(result.isError).toBe(true);
      expect(textOf(result)).toContain('archives are insider-only');
      expect(requests).toHaveLength(1);
    },
  );

  it('never returns the plugin key, though it sends it', async () => {
    const requests = fakeServer({
      'GET /api/link-info/j/a.md': documentInfo,
      'POST /api/share': shareReply(false),
    });
    const tools = pluginTools();
    for (const params of [{}, { share: {} }]) {
      const result = await runTool(tools, 'server_export', {
        path: 'j/a.md',
        format: 'pdf',
        ...params,
      });
      expect(textOf(result)).not.toContain(PLUGIN_KEY);
    }
    expect(
      requests.every((r) => r.url.searchParams.get('k') === PLUGIN_KEY),
    ).toBe(true);
  });
});
