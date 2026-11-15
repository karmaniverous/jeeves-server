import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';

import { catalogRoutes } from '../testing/catalogRoutes.js';

vi.mock('@karmaniverous/jeeves', async (importOriginal) => {
  const mod = await importOriginal<Record<string, unknown>>();
  return {
    ...mod,
    getServiceUrl: (name: string) =>
      `http://127.0.0.1:${name === 'watcher' ? '1936' : name === 'runner' ? '1937' : '1938'}`,
  };
});

// Mock fetch so service health checks don't make real HTTP calls
const mockFetch = vi.fn().mockRejectedValue(new Error('not reachable'));
vi.stubGlobal('fetch', mockFetch);

// Mock config
const mockConfig = {
  port: 1934,
  chromePath: '/usr/bin/chromium',
  authModes: ['keys'],
  resolvedInsiders: [{ email: 'a@b.com' }, { email: 'c@d.com' }],
  resolvedKeys: [{ name: 'primary' }],
  events: {
    deploy: { cmd: 'deploy.sh', schema: {} },
    notify: { cmd: 'notify.sh', schema: {} },
  },
  plantuml: {
    jarPath: '/tools/plantuml.jar',
    servers: ['https://plantuml.com/plantuml'],
  },
  exportFormats: ['pdf', 'docx', 'zip'],
  eventQueuePath: '/nonexistent/event-queue.jsonl',
};

vi.mock('../config/index.js', () => ({
  getConfig: () => mockConfig,
}));

// Must import AFTER mock
const { healthHandlers, withoutAdminDetails } = await import('./status.js');
const { standardServerHandlers } = await import('./standard.js');

/** The status handler's body for `request`. */
async function callStatus(request: unknown): Promise<unknown> {
  const { body } = await standardServerHandlers().status(
    { params: {}, query: {}, body: {} },
    request as never,
  );
  return body;
}

/** Call the /status handler as `request`, then close its hooks. */
async function statusAs(request: unknown) {
  const result = await callStatus(request);
  return (result as { health: Record<string, unknown> }).health;
}

describe('status exposure (Decision 22)', () => {
  const identity = (scopes: unknown) => ({
    query: {},
    access: { entry: 'status', class: 'public', identity: { scopes } },
  });

  it('shows event commands and the Chrome path to an admin', async () => {
    const health = await statusAs(identity(null));
    expect(health.events).toEqual([
      { name: 'deploy', cmd: 'deploy.sh' },
      { name: 'notify', cmd: 'notify.sh' },
    ]);
    expect(health.chrome).toEqual({
      configured: true,
      path: '/usr/bin/chromium',
    });
  });

  it.each([
    ['no identity', { query: {} }],
    ['a scoped identity', identity({ allow: ['/**'], deny: [] })],
  ])('omits them for %s', async (_label, request) => {
    const health = await statusAs(request);
    expect(health.events).toEqual([{ name: 'deploy' }, { name: 'notify' }]);
    expect(health.chrome).toEqual({ configured: true });
    expect(health.port).toBe(1934);
  });

  it('adds the sign-in redirect URIs to health.auth for anyone (#270)', async () => {
    const extra = {
      publicUrl: 'https://docs.example.com',
      authModes: ['google', 'keys'],
      oauth: { credentialDir: '/c', providers: { acme: {} } },
    };
    Object.assign(mockConfig, extra);
    try {
      const health = await statusAs({ query: {}, headers: {} });
      expect(health.auth).toEqual({
        modes: ['google', 'keys'],
        insiderCount: 2,
        keyCount: 1,
        googleRedirectUri: 'https://docs.example.com/auth/callback',
        oauthRedirectUri: 'https://docs.example.com/oauth/callback',
      });
    } finally {
      Object.assign(mockConfig, {
        publicUrl: undefined,
        authModes: ['keys'],
        oauth: undefined,
      });
    }
  });

  it('leaves a body without health, chrome or events as it is', () => {
    const bare = { name: 'server', health: undefined };
    expect(withoutAdminDetails(bare)).toBe(bare);
    expect(withoutAdminDetails({ health: { port: 1 } })).toEqual({
      health: { port: 1 },
    });
  });
});

describe('GET /status', () => {
  it('returns structured status with SDK shape', async () => {
    const result = await callStatus({ accessMode: 'insider', query: {} });
    const status = result as Record<string, unknown>;

    // Standard SDK fields at top level
    expect(status).toHaveProperty('name', 'server');
    expect(status).toHaveProperty('version');
    expect(status).toHaveProperty('uptime');
    expect(status).toHaveProperty('status', 'healthy');

    // Server-specific fields nested under health
    const health = status.health as Record<string, unknown>;
    expect(health.port).toBe(1934);
    expect((health.chrome as { configured: boolean }).configured).toBe(true);
    expect((health.auth as { insiderCount: number }).insiderCount).toBe(2);
    expect((health.auth as { keyCount: number }).keyCount).toBe(1);
    expect(health.events).toHaveLength(2);
    const exports = health.exports as {
      documents: string[];
      directories: string[];
      diagrams: string[];
      chromeAvailable: boolean;
    };
    expect(exports.documents).toEqual(['pdf', 'docx']);
    expect(exports.directories).toEqual(['zip']);
    expect(exports.diagrams).toEqual(['svg', 'png']);
    expect(exports.chromeAvailable).toBe(true);
    expect((health.diagrams as { mermaid: boolean }).mermaid).toBe(true);
    // Event queue progress (#302, #285): always sent.
    expect(health.eventQueue).toEqual({
      offset: 0,
      size: 0,
      pendingBytes: 0,
      parseErrors: 0,
    });

    // Services should be present (cache may or may not have populated)
    const services = health.services as Record<string, unknown>;
    expect(services).toHaveProperty('watcher');
    expect(services).toHaveProperty('runner');
    expect(services).toHaveProperty('meta');
  });
});

describe('GET /health (#259)', () => {
  it('returns { ok: true } without any credentials', async () => {
    const app = Fastify();
    await app.register(catalogRoutes(healthHandlers));

    const res = await app.inject('/health');
    await app.close();

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });
});
