/**
 * Tests for the API auth middleware: access mode resolution and insider
 * scope enforcement (#271).
 *
 * @packageDocumentation
 */

import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { NormalizedScopes } from '../../config/types.js';

vi.mock('../../config/index.js', () => ({
  getConfig: () => ({ resolvedKeys: [], resolvedInsiders: [] }),
}));

vi.mock('../../services/deepShareLinks.js', () => ({
  decodeStack: (s: string) => s.split(','),
}));

const resolveSessionAuth = vi.fn();
const resolveKeyAuth = vi.fn();
const resolveInsiderKeyAuth = vi.fn();
vi.mock('../../auth/resolve.js', () => ({
  extractDeepParams: (q: { d?: string; dirs?: string; s?: string }) =>
    q.d !== undefined && q.s !== undefined
      ? { d: q.d, dirs: q.dirs ?? '0', s: q.s }
      : undefined,
  resolveSessionAuth: (...args: unknown[]): unknown =>
    resolveSessionAuth(...args),
  resolveKeyAuth: (...args: unknown[]): unknown => resolveKeyAuth(...args),
  resolveInsiderKeyAuth: (...args: unknown[]): unknown =>
    resolveInsiderKeyAuth(...args),
}));

const { addAuthMiddleware, scopesAllowRoute } = await import('./middleware.js');

const contentScope: NormalizedScopes = {
  allow: ['/jeeves/content/**'],
  deny: [],
  explicitAllow: [],
  explicitDeny: [],
};

const FAIL = { valid: false };

function session(scopes: NormalizedScopes | null) {
  return {
    valid: true,
    mode: 'insider',
    seed: 'session-seed',
    scopes,
    email: 'user@example.com',
    keyAge: '1d ago',
  };
}

/** Echo the auth state the middleware attached to the request. */
const echo = (request: FastifyRequest) => ({
  accessMode: request.accessMode ?? null,
  authSeed: request.authSeed ?? null,
  insiderScopes: request.insiderScopes ?? null,
  insiderEmail: request.insiderEmail ?? null,
  authMatchedPath: request.authMatchedPath ?? null,
});

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify();
  addAuthMiddleware(app);
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
  app.post('/api/util/share-for', echo);
  app.get('/api/status', echo);
  await app.ready();
  return app;
}

describe('scopesAllowRoute', () => {
  it('leaves non-content routes to their handlers', () => {
    expect(scopesAllowRoute(null, contentScope)).toBe(true);
  });

  it('admits ancestors on navigation routes only', () => {
    expect(
      scopesAllowRoute({ prefix: '/api/path', path: '/jeeves' }, contentScope),
    ).toBe(true);
    expect(
      scopesAllowRoute({ prefix: '/api/raw', path: '/jeeves' }, contentScope),
    ).toBe(false);
  });
});

describe('auth middleware', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    resolveKeyAuth.mockReset().mockReturnValue(FAIL);
    resolveInsiderKeyAuth.mockReset().mockReturnValue(FAIL);
    resolveSessionAuth.mockReset().mockReturnValue(session(contentScope));
    app = await buildApp();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('scoped session insider', () => {
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
      expect(res.json()).toEqual({
        error: 'Path is outside your access scope',
      });
    });

    it.each([
      ['GET', '/api/file/jeeves/content/a.md'],
      ['GET', '/api/raw/jeeves/content/img/a.png'],
      ['PUT', '/api/file/jeeves/content/a.md'],
      ['POST', '/api/file/jeeves/content/a.md'],
      ['GET', '/api/path/jeeves'], // ancestor navigation
      ['GET', '/api/drives'], // non-content: handler filters
      ['POST', '/api/search'],
    ] as const)('%s %s → insider with session scopes', async (method, url) => {
      const res = await app.inject({ method, url, payload: {} });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({
        accessMode: 'insider',
        authSeed: 'session-seed',
        insiderEmail: 'user@example.com',
        insiderScopes: contentScope,
      });
    });

    it('prefers an in-scope session over a valid key', async () => {
      resolveKeyAuth.mockReturnValue({
        valid: true,
        mode: 'outsider',
        seed: 'key-seed',
        scopes: null,
        matchedPath: '/jeeves/content/a.md',
      });
      const res = await app.inject({
        url: '/api/raw/jeeves/content/a.md?key=k',
      });
      expect(res.json()).toMatchObject({
        accessMode: 'insider',
        authSeed: 'session-seed',
      });
    });

    it('falls back to a valid key when the path is outside session scope', async () => {
      resolveKeyAuth.mockReturnValue({
        valid: true,
        mode: 'outsider',
        seed: 'key-seed',
        scopes: null,
        matchedPath: '/jeeves/config/x.json',
      });
      const res = await app.inject({
        url: '/api/raw/jeeves/config/x.json?key=k',
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({
        accessMode: 'outsider',
        authSeed: 'key-seed',
        authMatchedPath: '/jeeves/config/x.json',
      });
    });
  });

  it('allows anything for an unscoped session insider', async () => {
    resolveSessionAuth.mockReturnValue(session(null));
    const res = await app.inject({ url: '/api/raw/jeeves/config/x.json' });
    expect(res.statusCode).toBe(200);
  });

  describe('URL keys (no session)', () => {
    beforeEach(() => {
      resolveSessionAuth.mockReturnValue(FAIL);
    });

    it('propagates the key scopes so handlers can filter (scoped machine insider key)', async () => {
      resolveKeyAuth.mockReturnValue({
        valid: true,
        mode: 'insider',
        seed: 'machine-seed',
        scopes: contentScope,
        matchedPath: null,
      });
      const res = await app.inject({
        url: '/api/export/jeeves/content?format=zip&key=k',
      });
      expect(res.json()).toMatchObject({
        accessMode: 'insider',
        insiderScopes: contentScope,
      });
    });

    it('verifies keys against the content path on every content route', async () => {
      await app.inject({ url: '/api/mermaid-export/j/a%20b.mmd?key=k&exp=9' });
      expect(resolveKeyAuth).toHaveBeenCalledWith(
        expect.anything(),
        '/j/a b.mmd',
        'k',
        '9',
        undefined,
      );
    });

    it('verifies /api/drives keys against the root', async () => {
      await app.inject({ url: '/api/drives?key=k' });
      expect(resolveKeyAuth.mock.calls[0][1]).toBe('/');
    });

    it('retries a directory share against the last stack entry', async () => {
      resolveKeyAuth.mockImplementation((_c: unknown, urlPath: string) =>
        urlPath === '/j/shared'
          ? {
              valid: true,
              mode: 'outsider',
              seed: 's',
              scopes: null,
              matchedPath: '/j/shared',
            }
          : FAIL,
      );
      const res = await app.inject({
        url: '/api/path/j/shared/sub?key=k&d=1&dirs=1&s=/j,/j/shared',
      });
      expect(res.statusCode).toBe(200);
      expect(resolveKeyAuth.mock.calls.map((c) => c[1] as string)).toEqual([
        '/j/shared/sub',
        '/j/shared',
      ]);
    });

    it('does not retry without dirs=1', async () => {
      const res = await app.inject({
        url: '/api/path/j/shared/sub?key=k&d=1&dirs=0&s=/j/shared',
      });
      expect(res.statusCode).toBe(401);
      expect(resolveKeyAuth).toHaveBeenCalledTimes(1);
    });

    it('returns 401 with no valid key', async () => {
      const res = await app.inject({ url: '/api/raw/jeeves/content/a.md' });
      expect(res.statusCode).toBe(401);
    });
  });

  it('skips auth for unauthenticated prefixes', async () => {
    resolveSessionAuth.mockReturnValue(FAIL);
    const res = await app.inject({ url: '/api/status' });
    expect(res.statusCode).toBe(200);
    expect(resolveSessionAuth).not.toHaveBeenCalled();
  });

  describe('/api/util/*', () => {
    const url = '/api/util/share-for?key=k';

    it('accepts an insider-mode URL key with its scopes', async () => {
      resolveSessionAuth.mockReturnValue(FAIL);
      resolveKeyAuth.mockReturnValue({
        valid: true,
        mode: 'insider',
        seed: 'machine-seed',
        scopes: contentScope,
      });
      const res = await app.inject({ method: 'POST', url });
      expect(res.json()).toMatchObject({
        accessMode: 'insider',
        authSeed: 'machine-seed',
        insiderScopes: contentScope,
      });
    });

    it('accepts a direct insider key', async () => {
      resolveSessionAuth.mockReturnValue(FAIL);
      resolveInsiderKeyAuth.mockReturnValue({
        valid: true,
        seed: 'insider-seed',
        scopes: null,
        email: 'a@example.com',
      });
      const res = await app.inject({ method: 'POST', url });
      expect(res.json()).toMatchObject({
        authSeed: 'insider-seed',
        insiderEmail: 'a@example.com',
      });
    });

    it('accepts a session without a key', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/util/share-for',
      });
      expect(res.json()).toMatchObject({ authSeed: 'session-seed' });
      expect(resolveKeyAuth).not.toHaveBeenCalled();
    });

    it('rejects anything else with 401', async () => {
      resolveSessionAuth.mockReturnValue(FAIL);
      const res = await app.inject({ method: 'POST', url });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('path traversal', () => {
    it.each([
      '/api/raw/jeeves/content/..%2F..%2Fconfig/x.json',
      '/api/raw/jeeves/content/a%5C..%5C..%5Cconfig%5Cx.json',
    ])('rejects %s with 400 before auth', async (url) => {
      const res = await app.inject({ url });
      expect(res.statusCode).toBe(400);
      expect(resolveSessionAuth).not.toHaveBeenCalled();
    });
  });
});
