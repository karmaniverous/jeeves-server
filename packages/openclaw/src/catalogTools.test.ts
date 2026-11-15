/**
 * Catalog tools: definitions from the catalog without share-credential parameters, and calls through the SDK with the plugin's key (none for `server_auth_status`), the `path` parameter as the entry's `*` path, results rewritten to the public URL and failures as tool errors.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { resetInit } from '@karmaniverous/jeeves';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CATALOG_TOOLS, catalogToolDefinitionFor } from './catalogTools.js';
import {
  BASE_URL,
  fakeServer,
  jsonOf,
  PLUGIN_KEY,
  pluginTools,
  runTool,
  textOf,
} from './test/fakeServer.js';

beforeEach(() => {
  vi.stubEnv('JEEVES_CONFIG_ROOT', '');
  vi.stubEnv('JEEVES_SERVER_PUBLIC_URL', '');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  resetInit();
});

describe('catalog tool definitions', () => {
  it.each(CATALOG_TOOLS)('$entry has no share-credential parameters', (c) => {
    const { parameters } = catalogToolDefinitionFor(c);
    const names = Object.keys(parameters['properties'] as object);
    for (const field of ['exp', 'd', 'dirs', 's', 'key'])
      expect(names).not.toContain(field);
  });

  it('drops authStatus path and leaves it without required parameters', () => {
    const { parameters } = catalogToolDefinitionFor({
      entry: 'authStatus',
      omit: ['path'],
    });
    expect(parameters['properties']).toEqual({});
    expect(parameters).not.toHaveProperty('required');
  });
});

describe('catalog tool calls', () => {
  it('sends the path as the wildcard path, encoded, with the plugin key as k', async () => {
    const requests = fakeServer({
      'GET /api/path/j/a%20b/c.md': {
        body: { name: 'c.md', path: 'j/a b/c.md', size: 1, mtime: 'x' },
      },
    });
    await runTool(pluginTools(), 'server_browse', { path: '/j/a b/c.md' });
    expect(requests[0]?.url.pathname).toBe('/api/path/j/a%20b/c.md');
    expect(requests[0]?.url.searchParams.get('k')).toBe(PLUGIN_KEY);
    expect(requests[0]?.url.searchParams.has('key')).toBe(false);
  });

  it('sends a body and the key to server_file_write', async () => {
    const requests = fakeServer({
      'PUT /api/file/j/a.md': {
        body: { ok: true, path: 'J:\\a.md', size: 1 },
      },
    });
    const result = await runTool(pluginTools(), 'server_file_write', {
      path: 'j/a.md',
      content: 'x',
    });
    expect(textOf(result)).not.toMatch(/^Error/);
    expect(requests[0]?.body).toEqual({ content: 'x' });
    expect(requests[0]?.url.searchParams.get('k')).toBe(PLUGIN_KEY);
  });

  it('sends server_resolve_path the key and fsPath', async () => {
    const requests = fakeServer({
      'GET /api/resolve-path': {
        body: { browsePath: 'j/a.md', browseUrl: '/browse/j/a.md' },
      },
    });
    const result = await runTool(pluginTools(), 'server_resolve_path', {
      fsPath: 'J:\\a.md',
    });
    expect(jsonOf(result)).toEqual({
      browsePath: 'j/a.md',
      browseUrl: '/browse/j/a.md',
    });
    expect(requests[0]?.url.searchParams.get('fsPath')).toBe('J:\\a.md');
    expect(requests[0]?.url.searchParams.get('k')).toBe(PLUGIN_KEY);
  });

  it('sends server_auth_status without the key', async () => {
    const requests = fakeServer({
      'GET /api/auth/status': {
        body: { authenticated: false, email: null, isInsider: false },
      },
    });
    await runTool(pluginTools(), 'server_auth_status');
    expect(requests[0]?.url.search).toBe('');
  });

  it('rewrites server URLs in results to the public URL', async () => {
    const root = mkdtempSync(join(tmpdir(), 'jeeves-server-openclaw-'));
    mkdirSync(join(root, 'jeeves-server'));
    writeFileSync(
      join(root, 'jeeves-server', 'config.json'),
      JSON.stringify({ publicUrl: 'https://jeeves.example.com' }),
    );
    try {
      fakeServer({
        'GET /api/drives': {
          body: [{ letter: 'j', label: `${BASE_URL}/browse/j` }],
        },
      });
      const result = await runTool(
        pluginTools({ configRoot: root }),
        'server_drives',
      );
      expect(jsonOf(result)).toEqual([
        { letter: 'j', label: 'https://jeeves.example.com/browse/j' },
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('reports an error response with its status, message and code', async () => {
    fakeServer({
      'GET /api/link-info/j/a.md': {
        status: 403,
        body: {
          statusCode: 403,
          code: 'SERVER_OUT_OF_SCOPE',
          error: 'Forbidden',
          message: 'Out of scope',
        },
      },
    });
    const result = await runTool(pluginTools(), 'server_link_info', {
      path: 'j/a.md',
    });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toBe(
      'Error: HTTP 403: Out of scope (SERVER_OUT_OF_SCOPE)',
    );
  });

  it('reports an unreachable server with the apiUrl guidance', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.reject(
          new TypeError('fetch failed', { cause: { code: 'ECONNREFUSED' } }),
        ),
      ),
    );
    const result = await runTool(pluginTools(), 'server_drives');
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain(`Service not reachable at ${BASE_URL}`);
  });

  it('reports invalid parameters without sending a request', async () => {
    const requests = fakeServer({});
    const result = await runTool(pluginTools(), 'server_file_mutate', {
      path: 'j/a.md',
      action: 'nonsense',
    });
    expect(result.isError).toBe(true);
    expect(requests).toEqual([]);
  });
});
