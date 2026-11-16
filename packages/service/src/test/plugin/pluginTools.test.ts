// @vitest-environment node
/**
 * The OpenClaw plugin (`packages/openclaw`) against the real app: every tool it registers, run with the plugin configured as `jeeves install` configures it (the API URL and an unscoped machine key seed), through an `inject`-backed `fetch`. Proves the standard config tools reach the admin routes with the plugin's key, the share and export URLs the tools return open, and no tool result carries the plugin's key (Decision 21).
 */

import path from 'node:path';

import type { ToolDescriptor, ToolResult } from '@karmaniverous/jeeves';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { computeInsiderKey } from '../../util/crypto.js';
import { injectFetch } from '../sdk/sdkHarness.js';
import { startWireApp, type WireApp } from '../wire/wireApp.js';
import { CACHED_EXPORT, WIRE_SEEDS } from '../wire/wireFixture.js';
import {
  jsonOf,
  pluginTools,
  routePluginFetch,
  runTool,
  statusOf as statusOfUrl,
} from './pluginHarness.js';

/** The key the plugin derives from its seed (the unscoped `primary` key). */
const PLUGIN_KEY = computeInsiderKey(WIRE_SEEDS.primary);

let wire: WireApp;
let root: string;

/** Every result text a tool returned, checked for the key at the end. */
const texts: string[] = [];

/** Run a tool, recording its result text. */
async function run(
  tools: Map<string, ToolDescriptor>,
  name: string,
  params: Record<string, unknown> = {},
): Promise<ToolResult> {
  const result = await runTool(tools, name, params);
  texts.push(result.content[0]?.text ?? '');
  return result;
}

/** The JSON of a successful result. */
async function json(
  tools: Map<string, ToolDescriptor>,
  name: string,
  params: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  return jsonOf(await run(tools, name, params));
}

/** Status of a GET of `url` (optionally with the admin's session cookie). */
const statusOf = (url: string, session = false) =>
  statusOfUrl(wire, url, session);

beforeAll(async () => {
  wire = await startWireApp();
  root = wire.rootUrl.slice(1);
  routePluginFetch(wire);
  vi.stubEnv('JEEVES_CONFIG_ROOT', '');
});

beforeEach(() => {
  wire.reset();
});

afterAll(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  await wire.close();
});

describe('plugin tools on the real app', () => {
  const tools = () => pluginTools(WIRE_SEEDS.primary);

  it('reaches the admin config routes with the plugin key, and not without', async () => {
    await expect(
      json(tools(), 'server_config', { path: '$.port' }),
    ).resolves.toMatchObject({ result: [1934] });
    await expect(
      json(tools(), 'server_config_apply', {
        config: { eventTimeoutMs: 1000 },
      }),
    ).resolves.toMatchObject({ applied: true });
    await expect(json(tools(), 'server_status')).resolves.toMatchObject({
      name: 'server',
    });
    const keyless = await run(pluginTools(), 'server_config');
    expect(keyless.isError).toBe(true);
    expect(keyless.content[0]?.text).toContain('401');
  });

  it('runs the catalog tools', async () => {
    const t = tools();
    await expect(json(t, 'server_drives')).resolves.toBeDefined();
    await expect(
      json(t, 'server_browse', { path: `/${root}/sub dir` }),
    ).resolves.toHaveProperty('entries');
    await expect(
      json(t, 'server_link_info', { path: `${root}/doc.md` }),
    ).resolves.toMatchObject({ exists: true, isDirectory: false });
    await expect(
      json(t, 'server_file_write', {
        path: `${root}/notes.markdown`,
        content: '# New\n',
      }),
    ).resolves.toMatchObject({ ok: true });
    await expect(
      json(t, 'server_file_mutate', {
        path: `${root}/doc.md`,
        action: 'toggle-checkbox',
        index: 0,
        checked: true,
      }),
    ).resolves.toEqual({ ok: true });
    await expect(
      json(t, 'server_export_cache_clear', { path: `${root}/doc.md` }),
    ).resolves.toHaveProperty('cleared');
    await expect(json(t, 'server_auth_status')).resolves.toMatchObject({
      authenticated: false,
    });
    await expect(
      json(t, 'server_resolve_path', {
        fsPath: path.join(wire.contentDir, 'doc.md'),
      }),
    ).resolves.toMatchObject({ browsePath: `${root}/doc.md` });
  });

  it('returns share page and raw URLs that open', async () => {
    const shared = await json(tools(), 'server_share', {
      path: `${root}/public/shared.md`,
      expiryDays: 1,
    });
    expect(
      await statusOf(
        String(shared['pageUrl']).replace('/browse/', '/api/file/'),
      ),
    ).toBe(200);
    expect(await statusOf(String(shared['rawUrl']))).toBe(200);
    await expect(
      json(tools(), 'server_share', {
        path: `${root}/doc.md`,
        insiders: ['stranger@wire.test'],
      }),
    ).resolves.toHaveProperty('type');
  });

  it('returns export URLs: unkeyed for a session, or from a signed share', async () => {
    const unkeyed = await json(tools(), 'server_export', {
      path: `${root}/doc.md`,
      format: 'pdf',
    });
    const url = String(unkeyed['url']);
    expect(new URL(url).search).toBe('?format=pdf');
    expect(await statusOf(url)).toBe(401);
    expect(await statusOf(url, true)).toBe(200);

    const signed = await json(tools(), 'server_export', {
      path: `${root}/doc.md`,
      format: 'pdf',
      share: {},
    });
    const res = await injectFetch(wire.app)(String(signed['url']), {});
    expect(res.status).toBe(200);
    expect(Buffer.from(await res.arrayBuffer()).equals(CACHED_EXPORT)).toBe(
      true,
    );

    const wrong = await run(tools(), 'server_export', {
      path: `${root}/doc.md`,
      format: 'zip',
    });
    expect(wrong.content[0]?.text).toContain('use pdf, docx');
  });

  it('runs server_event_status and the OAuth tools', async () => {
    await expect(
      json(tools(), 'server_event_status', { limit: 5 }),
    ).resolves.toMatchObject({ schemaCount: 1 });
    await expect(
      json(tools(), 'oauth_status', { provider: 'wire', account: 'me' }),
    ).resolves.toMatchObject({ exists: true });
    await expect(
      json(tools(), 'oauth_token', { provider: 'wire', account: 'me' }),
    ).resolves.toHaveProperty('access_token');
    await expect(
      json(tools(), 'oauth_authorize', {
        provider: 'wire',
        account: 'new',
        clientId: 'id',
        clientSecret: 'secret',
      }),
    ).resolves.toContain('Please open this URL');
  });

  it('never returns the plugin key', () => {
    expect(texts.length).toBeGreaterThanOrEqual(20);
    for (const text of texts) expect(text).not.toContain(PLUGIN_KEY);
  });
});
