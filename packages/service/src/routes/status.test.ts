import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';

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
};

vi.mock('../config/index.js', () => ({
  getConfig: () => mockConfig,
}));

// Must import AFTER mock
const { statusRoutes, withoutAdminDetails } = await import('./status.js');

/** Call the /status handler as `request`, then close its hooks. */
async function statusAs(request: unknown) {
  const routes: Record<string, (req: unknown) => Promise<unknown>> = {};
  const closeHooks: (() => Promise<void>)[] = [];
  const fakeFastify = {
    get: (path: string, handler: (req: unknown) => Promise<unknown>) => {
      routes[path] = handler;
    },
    addHook: (hook: string, handler: () => Promise<void>) => {
      if (hook === 'onClose') closeHooks.push(handler);
    },
  };
  statusRoutes(fakeFastify as never, {}, () => {});
  const result = await routes['/status'](request);
  await Promise.all(closeHooks.map((hook) => hook()));
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
    // Create a minimal Fastify-like test harness
    const routes: Record<string, (req: unknown) => Promise<unknown>> = {};
    const closeHooks: (() => Promise<void>)[] = [];
    const fakeFastify = {
      get: (path: string, handler: (req: unknown) => Promise<unknown>) => {
        routes[path] = handler;
      },
      addHook: (hook: string, handler: () => Promise<void>) => {
        if (hook === 'onClose') closeHooks.push(handler);
      },
    };

    statusRoutes(fakeFastify as never, {}, () => {});

    const handler = routes['/status'];
    expect(handler).toBeDefined();

    const result = await handler({ accessMode: 'insider', query: {} });
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

    // Services should be present (cache may or may not have populated)
    const services = health.services as Record<string, unknown>;
    expect(services).toHaveProperty('watcher');
    expect(services).toHaveProperty('runner');
    expect(services).toHaveProperty('meta');

    // Clean up background interval
    await Promise.all(closeHooks.map((hook) => hook()));
  });
});

describe('GET /health (#259)', () => {
  it('returns { ok: true } without any credentials', async () => {
    const app = Fastify();
    await app.register(statusRoutes);

    const res = await app.inject('/health');
    await app.close();

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });
});
