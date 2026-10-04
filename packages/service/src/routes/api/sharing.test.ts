/**
 * Route tests for POST /api/share: auth, insider scope enforcement (#271)
 * and share URL shapes.
 *
 * @packageDocumentation
 */

import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { NormalizedScopes } from '../../config/types.js';

vi.mock('../../config/index.js', () => ({
  getConfig: () => ({ roots: {}, resolvedKeys: [], resolvedInsiders: [] }),
  resetConfig: vi.fn(),
}));

const { sharingRoutes } = await import('./sharing.js');

const contentScope: NormalizedScopes = {
  allow: ['/j/content/**'],
  deny: [],
  explicitAllow: [],
  explicitDeny: [],
};

interface ShareResponse {
  url: string;
  path: string;
  exp: string | null;
  depth: number;
  dirs: boolean;
}

async function buildApp(
  seed: string | undefined,
  scopes: NormalizedScopes | null,
): Promise<FastifyInstance> {
  const app = Fastify();
  app.addHook('preHandler', (request, _reply, done) => {
    request.authSeed = seed;
    request.insiderScopes = scopes;
    done();
  });
  await app.register(sharingRoutes);
  await app.ready();
  return app;
}

const share = (app: FastifyInstance, payload: Record<string, unknown>) =>
  app.inject({ method: 'POST', url: '/api/share', payload });

describe('POST /api/share', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app.close();
  });

  it('requires an authenticated seed', async () => {
    app = await buildApp(undefined, null);
    const res = await share(app, { path: '/j/content/a.md' });
    expect(res.statusCode).toBe(401);
  });

  it('requires a path', async () => {
    app = await buildApp('seed', null);
    const res = await share(app, {});
    expect(res.statusCode).toBe(400);
  });

  describe('scoped sharer', () => {
    beforeEach(async () => {
      app = await buildApp('seed', contentScope);
    });

    it('refuses an out-of-scope target with 403', async () => {
      const res = await share(app, { path: '/j/config/secret.json' });
      expect(res.statusCode).toBe(403);
      expect(res.json()).toEqual({
        error: 'Path is outside your access scope',
      });
    });

    it('shares an in-scope target', async () => {
      const res = await share(app, { path: '/j/content/a.md' });
      expect(res.statusCode).toBe(200);
      expect(res.json<ShareResponse>().path).toBe('/j/content/a.md');
    });
  });

  describe('share URL shapes', () => {
    beforeEach(async () => {
      app = await buildApp('seed', null);
    });

    it('builds a plain path link', async () => {
      const body = (
        await share(app, { path: '/j/a.md' })
      ).json<ShareResponse>();
      expect(body.url).toMatch(/^\/browse\/j\/a\.md\?key=[0-9a-f]{32}$/);
      expect(body).toMatchObject({ exp: null, depth: 0, dirs: false });
    });

    it('builds an expiring link with a different key', async () => {
      const plain = (
        await share(app, { path: '/j/a.md' })
      ).json<ShareResponse>();
      const body = (
        await share(app, { path: '/j/a.md', expiry: '1700000000000' })
      ).json<ShareResponse>();
      expect(body.url).toMatch(
        /^\/browse\/j\/a\.md\?key=[0-9a-f]{32}&exp=1700000000000$/,
      );
      expect(body.url.split('&')[0]).not.toBe(plain.url);
      expect(body.exp).toBe('1700000000000');
    });

    it('builds a deep share link carrying depth, dirs and stack', async () => {
      const body = (
        await share(app, { path: '/j/dir', depth: 2, dirs: true, expiry: '9' })
      ).json<ShareResponse>();
      expect(body.url).toMatch(
        /^\/browse\/j\/dir\?key=[0-9a-f]{32}&d=2&dirs=1&s=[^&]+&exp=9$/,
      );
      expect(body).toMatchObject({ depth: 2, dirs: true });
    });
  });
});
