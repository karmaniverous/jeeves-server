import type * as Jeeves from '@karmaniverous/jeeves';
import type {
  PluginApi,
  ToolDescriptor,
  ToolResult,
} from '@karmaniverous/jeeves';
import { afterEach, describe, expect, it, vi } from 'vitest';

const fetchJsonMock = vi.hoisted(() => vi.fn());

vi.mock('@karmaniverous/jeeves', async (importOriginal) => {
  const actual = await importOriginal<typeof Jeeves>();
  return { ...actual, fetchJson: fetchJsonMock };
});

const { registerServerTools, toRawUrl } = await import('./serverTools.js');

const BASE_URL = 'http://127.0.0.1:1934';

/**
 * Register the server_* tools against a stub API and return them by name.
 * With `pluginKey`, the plugin is configured with that key seed.
 */
function collectTools(pluginKey?: string): Map<string, ToolDescriptor> {
  const tools = new Map<string, ToolDescriptor>();
  const api: PluginApi = {
    registerTool: (tool: ToolDescriptor) => {
      tools.set(tool.name, tool);
    },
    logger: { warn: vi.fn() },
    ...(pluginKey ? { pluginConfig: { pluginKey } } : {}),
  };
  if (pluginKey) vi.stubEnv('JEEVES_SERVER_PLUGIN_KEY', pluginKey);
  registerServerTools(api, BASE_URL, () => undefined);
  return tools;
}

/** Run a registered tool by name, answering its request with `response`. */
function run(
  name: string,
  params: Record<string, unknown>,
  response: unknown = {},
  pluginKey?: string,
): Promise<ToolResult> {
  fetchJsonMock.mockResolvedValueOnce(response);
  const tool = collectTools(pluginKey).get(name);
  if (!tool) throw new Error(`tool not registered: ${name}`);
  return tool.execute('call-1', params);
}

/** The URL and fetch options of the first request sent. */
function firstRequest(): { url: URL; options: unknown } {
  const [url, , options] = fetchJsonMock.mock.calls[0] as [
    string,
    unknown,
    unknown,
  ];
  return { url: new URL(url), options };
}

afterEach(() => {
  fetchJsonMock.mockReset();
  vi.unstubAllEnvs();
});

describe('server_share rawUrl (#278)', () => {
  it('maps a depth-0 file share onto /api/raw/ and keeps the key', async () => {
    const result = await run(
      'server_share',
      { path: 'j/docs/a.md' },
      { url: '/browse/j/docs/a.md?k=abc', path: '/j/docs/a.md', exp: null },
    );
    const text = JSON.stringify(result);
    expect(text).toContain(`${BASE_URL}/api/raw/j/docs/a.md?k=abc`);
    expect(text).not.toContain(`${BASE_URL}/raw/`);
  });

  it('only rewrites the leading /browse/ segment', () => {
    expect(toRawUrl(`${BASE_URL}/browse/j/browse/a.md?k=abc`)).toBe(
      `${BASE_URL}/api/raw/j/browse/a.md?k=abc`,
    );
  });
});

describe('plugin key (#279)', () => {
  it('is sent as k, never as key', async () => {
    await run('server_browse', { path: 'j' }, {}, 'seed');
    const { searchParams } = firstRequest().url;
    expect(searchParams.get('k')).toMatch(/^[0-9a-f]+$/u);
    expect(searchParams.has('key')).toBe(false);
  });

  it('is sent by server_resolve_path (authenticated since 3.15.0)', async () => {
    await run(
      'server_resolve_path',
      { fsPath: 'J:\\a.md' },
      { browsePath: 'j/a.md' },
      'seed',
    );
    const { url } = firstRequest();
    expect(url.pathname).toBe('/api/resolve-path');
    expect(url.searchParams.get('fsPath')).toBe('J:\\a.md');
    expect(url.searchParams.get('k')).toMatch(/^[0-9a-f]+$/u);
  });
});

describe('server_export timeout', () => {
  it('passes a 10-minute timeoutMs to fetchJson', async () => {
    await run('server_export', { path: 'j/docs/a.md', format: 'pdf' });

    expect(fetchJsonMock).toHaveBeenCalledTimes(1);
    const { url, options } = firstRequest();
    expect(`${url.pathname}${url.search}`).toBe(
      '/api/export/j/docs/a.md?format=pdf',
    );
    expect(options).toEqual({ timeoutMs: 600_000 });
  });

  it('leaves other tools on the core default timeout', async () => {
    await run('server_browse', { path: 'j/docs' });
    expect(firstRequest().options).toBeUndefined();
  });
});
