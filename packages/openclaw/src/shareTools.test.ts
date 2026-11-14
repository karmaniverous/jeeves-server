/**
 * `server_share` and `server_export` on the SDK: share and shareFor bodies, page and raw URLs (#278), expiry, and export URLs routed by format and path type, unkeyed or from a signed share, never carrying the plugin key (Decisions 19 and 21).
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

/** A `share` reply for the request's path. */
const shareReply =
  (isDirectory: boolean) =>
  (req: RecordedRequest): Reply => {
    const { path, expiry, depth, dirs } = req.body as {
      path: string;
      expiry?: string;
      depth?: number;
      dirs?: boolean;
    };
    const query = expiry ? `?k=out&exp=${expiry}` : '?k=out';
    return {
      body: {
        url: `/browse${path}${query}`,
        path,
        exp: expiry ?? null,
        depth: depth ?? 0,
        dirs: dirs ?? false,
        isDirectory,
      },
    };
  };

/** A `linkInfo` reply. */
const linkInfo = (isDirectory: boolean): Reply => ({
  body: { exists: true, isDirectory, pageUrl: '/browse/x', exportLinks: [] },
});

describe('server_share', () => {
  it('signs a file share and derives page and raw URLs', async () => {
    const requests = fakeServer({ 'POST /api/share': shareReply(false) });
    const result = await runTool(pluginTools(), 'server_share', {
      path: '/j/a.md',
    });
    expect(requests[0]?.body).toEqual({ path: '/j/a.md' });
    expect(requests[0]?.url.searchParams.get('k')).toBe(PLUGIN_KEY);
    expect(jsonOf(result)).toMatchObject({
      url: `${BASE_URL}/browse/j/a.md?k=out`,
      pageUrl: `${BASE_URL}/browse/j/a.md?k=out`,
      rawUrl: `${BASE_URL}/api/raw/j/a.md?k=out`,
    });
  });

  it('gives a directory share no raw URL', async () => {
    fakeServer({ 'POST /api/share': shareReply(true) });
    const result = await runTool(pluginTools(), 'server_share', {
      path: 'j/docs',
      depth: 2,
      dirs: true,
    });
    expect(jsonOf(result)).not.toHaveProperty('rawUrl');
    expect(jsonOf(result)).toMatchObject({ depth: 2, dirs: true });
  });

  it('sends an epoch-ms expiry only when expiryDays is set', async () => {
    const requests = fakeServer({ 'POST /api/share': shareReply(false) });
    const tools = pluginTools();
    await runTool(tools, 'server_share', { path: 'j/a.md', expiryDays: 2 });
    expect(requests[0]?.body).toEqual({
      path: '/j/a.md',
      expiry: String(NOW + 2 * 86_400_000),
    });
  });

  it('uses shareFor when insiders are named, passing its reply through', async () => {
    const reply = { url: 'https://x.test/browse/j/a.md', type: 'insider' };
    const requests = fakeServer({
      'POST /api/util/share-for': { body: reply },
    });
    const result = await runTool(pluginTools(), 'server_share', {
      path: 'j/a.md',
      insiders: ['a@x.test'],
      enforceOutsiderPolicy: false,
      expiryDays: 3,
    });
    expect(requests[0]?.body).toEqual({
      path: '/j/a.md',
      insiders: ['a@x.test'],
      enforceOutsiderPolicy: false,
    });
    expect(jsonOf(result)).toEqual(reply);
  });
});

describe('server_export', () => {
  it.each([
    ['j/a.md', false, 'pdf', '/api/export/j/a.md?format=pdf'],
    ['j/a.markdown', false, 'docx', '/api/export/j/a.markdown?format=docx'],
    ['j/docs', true, 'zip', '/api/export/j/docs?format=zip'],
    ['j/docs', true, 'tar', '/api/export/j/docs?format=tar'],
    ['j/d.mmd', false, 'svg', '/api/mermaid-export/j/d.mmd?format=svg'],
    ['j/d.puml', false, 'png', '/api/plantuml-export/j/d.puml?format=png'],
    [
      'j/d.plantuml',
      false,
      'svg',
      '/api/plantuml-export/j/d.plantuml?format=svg',
    ],
  ])('%s as %s: an unkeyed URL', async (path, isDirectory, format, url) => {
    const requests = fakeServer({
      [`GET /api/link-info/${path}`]: linkInfo(isDirectory),
    });
    const result = await runTool(pluginTools(), 'server_export', {
      path,
      format,
    });
    expect(jsonOf(result)).toEqual({ path, format, url: BASE_URL + url });
    expect(requests).toHaveLength(1);
  });

  it.each([
    ['j/a.md', false, 'zip', 'use pdf, docx'],
    ['j/docs', true, 'pdf', 'use zip, tar'],
    ['j/d.mmd', false, 'pdf', 'use svg, png'],
  ])(
    '%s as %s is an error naming the valid formats',
    async (path, dir, format, valid) => {
      fakeServer({ [`GET /api/link-info/${path}`]: linkInfo(dir) });
      const result = await runTool(pluginTools(), 'server_export', {
        path,
        format,
      });
      expect(result.isError).toBe(true);
      expect(textOf(result)).toContain(`Format "${format}"`);
      expect(textOf(result)).toContain(valid);
    },
  );

  it('reports a file with no export formats, and a missing path', async () => {
    fakeServer({
      'GET /api/link-info/j/a.txt': linkInfo(false),
      'GET /api/link-info/j/none.md': { body: { exists: false } },
    });
    const tools = pluginTools();
    const txt = await runTool(tools, 'server_export', {
      path: 'j/a.txt',
      format: 'pdf',
    });
    expect(textOf(txt)).toBe('Error: j/a.txt has no export formats');
    const missing = await runTool(tools, 'server_export', {
      path: 'j/none.md',
      format: 'pdf',
    });
    expect(textOf(missing)).toBe('Error: Not found: j/none.md');
  });

  it('with share, derives the URL from a signed share', async () => {
    const requests = fakeServer({
      'GET /api/link-info/j/a.md': linkInfo(false),
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

  it.each(['zip', 'tar'])(
    'with share, a directory %s is an error and signs nothing (archives are insider-only)',
    async (format) => {
      const requests = fakeServer({
        'GET /api/link-info/j/docs': linkInfo(true),
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
      'GET /api/link-info/j/a.md': linkInfo(false),
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
