/**
 * Tests for the API auth middleware's insider scope enforcement (#271).
 *
 * @packageDocumentation
 */

import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as ResolveModule from '../../auth/resolve.js';
import type { NormalizedScopes } from '../../config/types.js';

vi.mock('../../config/index.js', () => ({
  getConfig: () => ({ resolvedKeys: [], resolvedInsiders: [] }),
}));

const resolveSessionAuth = vi.fn();
const resolveKeyAuth = vi.fn();
vi.mock('../../auth/resolve.js', async (importOriginal) => ({
  ...(await importOriginal<typeof ResolveModule>()),
  resolveSessionAuth: (...args: unknown[]) =>
    resolveSessionAuth(...args) as unknown,
  resolveKeyAuth: (...args: unknown[]) => resolveKeyAuth(...args) as unknown,
  resolveInsiderKeyAuth: () => ({ valid: false }),
}));

const { addAuthMiddleware } = await import('./middleware.js');

const contentScope: NormalizedScopes = {
  allow: ['/jeeves/content/**'],
  deny: [],
  explicitAllow: [],
  explicitDeny: [],
};

function session(scopes: NormalizedScopes | null) {
  return {
    valid: true,
    mode: 'insider',
    seed: 'seed',
    scopes,
    email: 'user@example.com',
    keyAge: null,
  };
}

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify();
  addAuthMiddleware(app);
  const echo = (request: { accessMode?: string }) => ({
    ok: true,
    accessMode: request.accessMode,
  });
  for (const prefix of [
    '/api/path',
    '/api/file',
    '/api/raw',
    '/api/export',
    '/api/export-cache',
    '/api/mermaid-export',
    '/api/plantuml-export',
    '/api/link-info',
  ]) {
    app.get(`${prefix}/*`, echo);
  }
  app.put('/api/file/*', echo);
  app.post('/api/file/*', echo);
  app.get('/api/drives', echo);
  app.post('/api/search', echo);
  await app.ready();
  return app;
}

describe('auth middleware: session insider scopes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    resolveKeyAuth.mockReturnValue({ valid: false });
    resolveSessionAuth.mockReturnValue(session(contentScope));
    app = await buildApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it.each([
    ['GET', '/api/path/jeeves/config/x.json'],
    ['GET', '/api/file/jeeves/config/x.json'],
    ['GET', '/api/raw/jeeves/config/x.json'],
    ['GET', '/api/export/jeeves/config/x.md?format=pdf'],
    ['GET', '/api/export/jeeves?format=zip'],
    ['GET', '/api/export-cache/jeeves/config/x.md'],
    ['GET', '/api/mermaid-export/jeeves/config/x.mmd'],
    ['GET', '/api/plantuml-export/jeeves/config/x.puml'],
    ['GET', '/api/link-info/openclaw/x'],
    ['PUT', '/api/file/jeeves/config/x.json'],
    ['POST', '/api/file/jeeves/notes.md'],
  ] as const)('%s %s outside scope → 403', async (method, url) => {
    const res = await app.inject({ method, url, payload: {} });
    expect(res.statusCode).toBe(403);
  });

  it.each([
    ['GET', '/api/file/jeeves/content/a.md'],
    ['GET', '/api/raw/jeeves/content/img/a.png'],
    ['GET', '/api/export/jeeves/content/a.md?format=pdf'],
    ['PUT', '/api/file/jeeves/content/a.md'],
    ['POST', '/api/file/jeeves/content/a.md'],
    // Ancestor navigation still works for listings
    ['GET', '/api/path/jeeves'],
    ['GET', '/api/path/jeeves/content'],
    // Non-content routes are scoped by their own handlers
    ['GET', '/api/drives'],
    ['POST', '/api/search'],
  ] as const)('%s %s in scope → 200 insider', async (method, url) => {
    const res = await app.inject({ method, url, payload: {} });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ accessMode: 'insider' });
  });

  it('allows anything for an unscoped session insider', async () => {
    resolveSessionAuth.mockReturnValue(session(null));
    const res = await app.inject({ url: '/api/raw/jeeves/config/x.json' });
    expect(res.statusCode).toBe(200);
  });

  it('falls back to a valid key when the path is outside session scope', async () => {
    resolveKeyAuth.mockReturnValue({
      valid: true,
      mode: 'outsider',
      seed: 'other',
      matchedPath: '/jeeves/config/x.json',
    });
    const res = await app.inject({
      url: '/api/raw/jeeves/config/x.json?key=abc',
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ accessMode: 'outsider' });
  });

  it('returns 401 with no session and no key', async () => {
    resolveSessionAuth.mockReturnValue({ valid: false });
    const res = await app.inject({ url: '/api/raw/jeeves/content/a.md' });
    expect(res.statusCode).toBe(401);
  });

  it.each([
    '/api/raw/jeeves/content/..%2F..%2Fconfig/x.json',
    '/api/raw/jeeves/content/a%5C..%5C..%5Cconfig%5Cx.json',
  ])('rejects traversal %s with 400', async (url) => {
    const res = await app.inject({ url });
    expect(res.statusCode).toBe(400);
  });

  it('rejects dot-segment traversal', async () => {
    // inject() may normalise `%2e%2e` segments before the hook sees the URL,
    // in which case the out-of-scope check rejects it instead.
    const res = await app.inject({
      url: '/api/file/jeeves/content/%2e%2e/%2e%2e/config/x.json',
    });
    expect([400, 403]).toContain(res.statusCode);
  });
});
