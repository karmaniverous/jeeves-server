import {
  type PluginApi,
  SERVER_PORT,
  type ToolDescriptor,
} from '@karmaniverous/jeeves';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PLUGIN_ID } from './constants.js';
import register from './index.js';

/** Register the plugin and return its tools by name. */
function registerTools(pluginConfig: Record<string, unknown> = {}) {
  const tools = new Map<string, ToolDescriptor>();
  const api: PluginApi = {
    registerTool: (tool: ToolDescriptor) => {
      tools.set(tool.name, tool);
    },
    logger: { warn: vi.fn() },
    config: { plugins: { entries: { [PLUGIN_ID]: { config: pluginConfig } } } },
  };
  register(api);
  return tools;
}

/** URL of the first stubbed fetch call. */
function fetchedUrl(): string {
  const input = vi.mocked(fetch).mock.calls[0]?.[0];
  return input instanceof Request ? input.url : String(input);
}

describe('standard tools apiUrl', () => {
  beforeEach(() => {
    vi.stubEnv('JEEVES_SERVER_URL', '');
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ status: 'ok' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        ),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('calls the configured apiUrl from server_status', async () => {
    const tools = registerTools({ apiUrl: 'http://server.test:9999/' });

    const result = await tools.get('server_status')?.execute('id', {});

    expect(result?.isError).toBeFalsy();
    expect(fetchedUrl()).toBe('http://server.test:9999/status');
  });

  it('reads apiUrl per call, not at registration', async () => {
    const pluginConfig: Record<string, unknown> = {};
    const tools = registerTools(pluginConfig);
    pluginConfig['apiUrl'] = 'http://later.test:4321';

    await tools.get('server_status')?.execute('id', {});

    expect(fetchedUrl()).toBe('http://later.test:4321/status');
  });

  it('falls back to the default port when apiUrl is unset', async () => {
    const tools = registerTools();

    await tools.get('server_status')?.execute('id', {});

    expect(fetchedUrl()).toBe(`http://127.0.0.1:${String(SERVER_PORT)}/status`);
  });
});
