import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  getConfigRoot,
  type PluginApi,
  recordRegisteredHooks,
  resetInit,
  type ToolDescriptor,
  type ToolResult,
  validateConversationHooks,
} from '@karmaniverous/jeeves';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CONFIG_ROOT_MISSING_MESSAGE,
  CONFIG_ROOT_UNSET_WARNING,
} from './configRoot.js';
import { PLUGIN_ID } from './constants.js';
import register from './index.js';

const BASE_URL = 'http://127.0.0.1:1934';
const PUBLIC_URL = 'https://jeeves.example.com';

function createApi(overrides: Partial<PluginApi> = {}) {
  const tools = new Map<string, ToolDescriptor>();
  const warn = vi.fn();
  const api: PluginApi = {
    registerTool: (tool: ToolDescriptor) => {
      tools.set(tool.name, tool);
    },
    logger: { warn },
    ...overrides,
  };
  return { api, tools, warn };
}

function run(
  tools: Map<string, ToolDescriptor>,
  name: string,
  params: Record<string, unknown> = {},
): Promise<ToolResult> {
  const tool = tools.get(name);
  if (!tool) throw new Error(`tool not registered: ${name}`);
  return tool.execute('call-1', params);
}

/** Config root holding a server config with a publicUrl. */
function makeConfigRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'jeeves-server-openclaw-'));
  mkdirSync(join(root, 'jeeves-server'), { recursive: true });
  writeFileSync(
    join(root, 'jeeves-server', 'config.json'),
    JSON.stringify({ publicUrl: PUBLIC_URL }),
  );
  return root;
}

const manifest = JSON.parse(
  readFileSync(new URL('../openclaw.plugin.json', import.meta.url), 'utf-8'),
) as { contracts: { tools: string[] } };

describe('register', () => {
  let root: string;

  beforeEach(() => {
    root = makeConfigRoot();
    vi.stubEnv('JEEVES_CONFIG_ROOT', '');
    vi.stubEnv('JEEVES_SERVER_PUBLIC_URL', '');
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ url: `${BASE_URL}/browse/j/a.md` }), {
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
    resetInit();
    rmSync(root, { recursive: true, force: true });
  });

  it('succeeds with no config, warns once, and registers every manifest tool', () => {
    const { api, tools, warn } = createApi();

    expect(() => {
      register(api);
    }).not.toThrow();

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toBe(CONFIG_ROOT_UNSET_WARNING);
    expect([...tools.keys()].sort()).toEqual(
      [...manifest.contracts.tools].sort(),
    );
    expect(() => getConfigRoot()).toThrow(/init\(\) must be called first/);
  });

  it('runs HTTP-only tools without configRoot', async () => {
    const { api, tools, warn } = createApi();
    register(api);

    for (const [name, params] of [
      ['server_status', {}],
      ['server_config', {}],
      ['server_config_apply', { config: {} }],
      ['server_drives', {}],
    ] as const) {
      const result = await run(tools, name, params);
      expect(result.isError).toBeFalsy();
    }
    // No publicUrl without configRoot: URLs are returned unrewritten.
    expect((await run(tools, 'server_drives')).content[0]?.text).toContain(
      `${BASE_URL}/browse/j/a.md`,
    );
    expect(fetch).toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(() => getConfigRoot()).toThrow(/init\(\) must be called first/);
  });

  it('returns a clear error from a configRoot-reading call without config', async () => {
    const { api, tools, warn } = createApi();
    register(api);

    const result = await run(tools, 'server_service', { action: 'install' });

    expect(result.isError).toBe(true);
    const text = result.content[0]?.text ?? '';
    expect(text).toContain(CONFIG_ROOT_MISSING_MESSAGE);
    expect(text).toContain('configRoot not configured');
    expect(text).toContain(`plugins.entries.${PLUGIN_ID}.config.configRoot`);
    expect(text).toContain('JEEVES_CONFIG_ROOT');
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('passes non-install server_service calls through the gate without configRoot', async () => {
    const { api, tools } = createApi();
    register(api);

    // An invalid action reaches core's service tool (which rejects it) without
    // touching a real service; the configRoot gate must not intercept it.
    const result = await run(tools, 'server_service', { action: 'bogus' });

    expect(result.isError).toBe(true);
    const text = result.content[0]?.text ?? '';
    expect(text).toContain('Invalid action: bogus');
    expect(text).not.toContain('configRoot not configured');
  });

  it('works with configRoot from plugin config', async () => {
    const { api, tools, warn } = createApi({
      pluginConfig: { configRoot: root },
    });
    register(api);

    const result = await run(tools, 'server_drives');

    expect(warn).not.toHaveBeenCalled();
    expect(result.isError).toBeFalsy();
    expect(result.content[0]?.text).toContain(`${PUBLIC_URL}/browse/j/a.md`);
    expect(getConfigRoot()).toBe(root);
  });

  it('works with configRoot from the OpenClaw config entry', async () => {
    const { api, tools } = createApi({
      config: {
        plugins: { entries: { [PLUGIN_ID]: { config: { configRoot: root } } } },
      },
    });
    register(api);

    const result = await run(tools, 'server_drives');

    expect(result.isError).toBeFalsy();
    expect(getConfigRoot()).toBe(root);
  });

  it('works with configRoot from JEEVES_CONFIG_ROOT', async () => {
    vi.stubEnv('JEEVES_CONFIG_ROOT', root);
    const { api, tools, warn } = createApi();
    register(api);

    const result = await run(tools, 'server_drives');

    expect(warn).not.toHaveBeenCalled();
    expect(result.isError).toBeFalsy();
    expect(result.content[0]?.text).toContain(PUBLIC_URL);
    expect(getConfigRoot()).toBe(root);
  });

  it('picks up configRoot set after registration', async () => {
    const pluginConfig: Record<string, unknown> = {};
    const { api, tools, warn } = createApi({ pluginConfig });
    register(api);
    expect(
      (await run(tools, 'server_service', { action: 'install' })).isError,
    ).toBe(true);
    expect((await run(tools, 'server_drives')).content[0]?.text).not.toContain(
      PUBLIC_URL,
    );

    pluginConfig['configRoot'] = root;

    expect((await run(tools, 'server_drives')).content[0]?.text).toContain(
      PUBLIC_URL,
    );
    expect(getConfigRoot()).toBe(root);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('reads publicUrl at invocation time (oauth_authorize origin)', async () => {
    const { api, tools } = createApi({ pluginConfig: { configRoot: root } });
    register(api);
    writeFileSync(
      join(root, 'jeeves-server', 'config.json'),
      JSON.stringify({ publicUrl: 'https://later.example.com' }),
    );

    await run(tools, 'oauth_authorize', {
      provider: 'google',
      account: 'a',
      clientId: 'id',
      clientSecret: 'secret',
    });

    const init = vi.mocked(fetch).mock.calls[0]?.[1];
    expect(typeof init?.body).toBe('string');
    expect(JSON.parse(init?.body as string)).toMatchObject({
      origin: 'https://later.example.com',
    });
  });

  it('registers no conversation hooks and declares none', async () => {
    const hooks = await recordRegisteredHooks(register, {
      pluginConfig: { configRoot: root },
    });
    const pkg: unknown = JSON.parse(
      readFileSync(new URL('../package.json', import.meta.url), 'utf-8'),
    );

    expect(hooks).toEqual([]);
    expect(validateConversationHooks(pkg, hooks)).toEqual([]);
  });
});
