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
  mermaidCliPath: '/tools/mermaid',
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
const { statusRoutes } = await import('./status.js');

describe('GET /status', () => {
  it('returns structured status with SDK shape', async () => {
    // Create a minimal Fastify-like test harness
    const routes: Record<string, (req: unknown) => Promise<unknown>> = {};
    const fakeFastify = {
      get: (path: string, handler: (req: unknown) => Promise<unknown>) => {
        routes[path] = handler;
      },
      addHook: (_hook: string, _handler: unknown) => {
        // no-op for test harness
      },
    };

    await statusRoutes(fakeFastify as never, {});

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
  });
});
