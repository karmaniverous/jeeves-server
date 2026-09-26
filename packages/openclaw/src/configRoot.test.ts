import {
  getConfigRoot,
  type PluginApi,
  resetInit,
  type ToolDescriptor,
} from '@karmaniverous/jeeves';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CONFIG_ROOT_MISSING_MESSAGE,
  createConfigRootResolver,
  createGuardedApi,
  guardTool,
} from './configRoot.js';

const okResult = { content: [{ type: 'text', text: 'ran' }] };

function makeTool(): ToolDescriptor {
  return {
    name: 'demo',
    description: 'demo tool',
    parameters: { type: 'object', properties: {} },
    execute: vi.fn(() => Promise.resolve(okResult)),
  };
}

describe('createConfigRootResolver', () => {
  beforeEach(() => {
    vi.stubEnv('JEEVES_CONFIG_ROOT', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    resetInit();
  });

  it('treats a blank configRoot as unset and warns only once', () => {
    const warn = vi.fn();
    const resolver = createConfigRootResolver({
      registerTool: vi.fn(),
      logger: { warn },
      pluginConfig: { configRoot: '   ' },
    });

    resolver.warnIfUnset();
    expect(resolver.resolve()).toBeUndefined();
    resolver.warnIfUnset();

    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('falls back to console.warn without a host logger', () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    createConfigRootResolver({ registerTool: vi.fn() }).warnIfUnset();

    expect(consoleWarn).toHaveBeenCalledWith(
      expect.stringContaining(CONFIG_ROOT_MISSING_MESSAGE),
    );
  });

  it('does not warn when configRoot is set', () => {
    const warn = vi.fn();
    const resolver = createConfigRootResolver({
      registerTool: vi.fn(),
      logger: { warn },
      pluginConfig: { configRoot: '/cfg' },
    });

    resolver.warnIfUnset();

    expect(warn).not.toHaveBeenCalled();
  });

  it('initializes core lazily and re-initializes when the root changes', () => {
    const pluginConfig: Record<string, unknown> = { configRoot: ' /cfg-a ' };
    const resolver = createConfigRootResolver({
      registerTool: vi.fn(),
      pluginConfig,
      resolvePath: () => '/workspace',
    });
    expect(() => getConfigRoot()).toThrow();

    expect(resolver.resolve()).toBe('/cfg-a');
    expect(getConfigRoot()).toBe('/cfg-a');

    pluginConfig['configRoot'] = '/cfg-b';
    expect(resolver.resolve()).toBe('/cfg-b');
    expect(getConfigRoot()).toBe('/cfg-b');
  });
});

describe('guardTool', () => {
  it('runs the tool when configRoot resolves', async () => {
    const tool = makeTool();
    const guarded = guardTool(tool, {
      resolve: () => '/cfg',
      warnIfUnset: vi.fn(),
    });

    await expect(guarded.execute('id', { a: 1 })).resolves.toBe(okResult);
    expect(tool.execute).toHaveBeenCalledWith('id', { a: 1 });
    expect(guarded.name).toBe('demo');
  });

  it('returns the missing-config error without running the tool', async () => {
    const tool = makeTool();
    const guarded = guardTool(tool, {
      resolve: () => undefined,
      warnIfUnset: vi.fn(),
    });

    const result = await guarded.execute('id', {});

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain(CONFIG_ROOT_MISSING_MESSAGE);
    expect(tool.execute).not.toHaveBeenCalled();
  });
});

describe('createGuardedApi', () => {
  it('guards registered tools and passes other members through', async () => {
    const registered: ToolDescriptor[] = [];
    const api: PluginApi = {
      registerTool: (tool) => {
        registered.push(tool);
      },
      pluginConfig: { apiUrl: 'http://x' },
    };
    const guardedApi = createGuardedApi(api, {
      resolve: () => undefined,
      warnIfUnset: vi.fn(),
    });

    guardedApi.registerTool(makeTool(), { optional: true });

    expect(guardedApi.pluginConfig).toBe(api.pluginConfig);
    expect(registered).toHaveLength(1);
    expect((await registered[0].execute('id', {})).isError).toBe(true);
  });
});
