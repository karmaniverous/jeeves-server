/**
 * `server_event_status` on the SDK: `status` (no key, public) and `listEvents` (with the key), combined in the 0.15.0 shape.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  fakeServer,
  jsonOf,
  PLUGIN_KEY,
  pluginTools,
  runTool,
} from './test/fakeServer.js';

/** A `/status` reply with two configured events. */
const STATUS = {
  name: 'server',
  version: '3.16.0',
  uptime: 1,
  status: 'healthy',
  health: {
    port: 1934,
    chrome: { configured: false },
    auth: { modes: [], insiderCount: 0, keyCount: 1 },
    events: [{ name: 'a' }, { name: 'b' }],
    eventQueue: { offset: 0, size: 0, pendingBytes: 0, parseErrors: 0 },
    exports: {
      documents: [],
      directories: [],
      diagrams: [],
      chromeAvailable: false,
    },
    diagrams: { mermaid: false, plantuml: { localJar: false, servers: [] } },
    services: {
      watcher: { url: 'http://w', reachable: false },
      runner: { url: 'http://r', reachable: false },
      meta: { url: 'http://m', reachable: false },
      lastChecked: null,
    },
    branding: { name: 'Jeeves' },
  },
};

/** One event log entry. */
const EVENT = {
  ts: '2026-11-14T00:00:00.000Z',
  event: 'a',
  matched: true,
  exitCode: 0,
};

beforeEach(() => {
  vi.stubEnv('JEEVES_CONFIG_ROOT', '');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('server_event_status', () => {
  it('combines the configured events and the recent log', async () => {
    const requests = fakeServer({
      'GET /status': { body: STATUS },
      'GET /api/events': { body: [EVENT] },
    });
    const result = await runTool(pluginTools(), 'server_event_status', {
      limit: 5,
    });
    expect(jsonOf(result)).toEqual({
      activeSchemas: STATUS.health.events,
      schemaCount: 2,
      recentEvents: [EVENT],
      recentCount: 1,
    });
    const events = requests.find((r) => r.url.pathname === '/api/events');
    expect(events?.url.searchParams.get('limit')).toBe('5');
    expect(events?.url.searchParams.get('k')).toBe(PLUGIN_KEY);
    const status = requests.find((r) => r.url.pathname === '/status');
    expect(status?.url.search).toBe('');
  });

  it('asks for 20 events by default', async () => {
    const requests = fakeServer({
      'GET /status': { body: STATUS },
      'GET /api/events': { body: [] },
    });
    await runTool(pluginTools(), 'server_event_status');
    const events = requests.find((r) => r.url.pathname === '/api/events');
    expect(events?.url.searchParams.get('limit')).toBe('20');
  });
});
