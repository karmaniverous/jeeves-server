/**
 * `server_share` on the SDK: share and shareFor bodies, page and raw URLs (#278) and expiry.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  BASE_URL,
  fakeServer,
  jsonOf,
  PLUGIN_KEY,
  pluginTools,
  runTool,
  shareReply,
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
