import { describe, expect, it, vi } from 'vitest';

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
  watcherUrl: null,
  runnerUrl: null,
  exportFormats: ['pdf', 'docx', 'zip'],
};

vi.mock('../../config/index.js', () => ({
  getConfig: () => mockConfig,
}));

// Must import AFTER mock
const { statusRoutes } = await import('./status.js');

describe('GET /api/status', () => {
  it('returns structured status for insider requests', async () => {
    // Create a minimal Fastify-like test harness
    const routes: Record<string, (req: unknown) => Promise<unknown>> = {};
    const fakeFastify = {
      get: (path: string, handler: (req: unknown) => Promise<unknown>) => {
        routes[path] = handler;
      },
    };

    await statusRoutes(fakeFastify as never, {});

    const handler = routes['/api/status'];
    expect(handler).toBeDefined();

    const result = await handler({ accessMode: 'insider' });
    const status = result as Record<string, unknown>;

    expect(status).toHaveProperty('version');
    expect(status).toHaveProperty('uptime');
    expect(status.port).toBe(1934);
    expect((status.chrome as { configured: boolean }).configured).toBe(true);
    expect((status.auth as { insiderCount: number }).insiderCount).toBe(2);
    expect((status.auth as { keyCount: number }).keyCount).toBe(1);
    expect(status.events).toHaveLength(2);
    expect(status.exportFormats).toEqual(['pdf', 'docx', 'zip']);
    expect((status.diagrams as { mermaid: boolean }).mermaid).toBe(true);
  });

  it('rejects non-insider requests', async () => {
    const routes: Record<string, (req: unknown) => Promise<unknown>> = {};
    const fakeFastify = {
      get: (path: string, handler: (req: unknown) => Promise<unknown>) => {
        routes[path] = handler;
      },
    };

    await statusRoutes(fakeFastify as never, {});
    const result = await routes['/api/status']({ accessMode: 'outsider' });
    expect(result).toEqual({ error: 'Insider auth required' });
  });
});
