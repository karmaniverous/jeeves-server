/**
 * Route-level tests for insider scope filtering in drives and directory
 * listings (#271).
 *
 * @packageDocumentation
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { NormalizedScopes } from '../../config/types.js';
import type * as PlatformModule from '../../util/platform.js';

let tmpDir = '';

vi.mock('../../config/index.js', () => ({
  getConfig: () => ({ roots: {} }),
}));

// Map URL root "j" to a temp directory; also expose a second root "c".
vi.mock('../../util/platform.js', async (importOriginal) => ({
  ...(await importOriginal<typeof PlatformModule>()),
  getRoots: () => [
    { id: 'c', label: 'C:', fsPath: '/unused-c' },
    { id: 'j', label: 'J:', fsPath: '/unused-j' },
  ],
  urlPathToFs: (reqPath: string) => {
    const parts = reqPath.replace(/^\/+/, '').split('/');
    return parts[0] === 'j' ? path.join(tmpDir, ...parts.slice(1)) : null;
  },
  fsPathToUrl: (fsPath: string) =>
    '/j' +
    path
      .relative(tmpDir, fsPath)
      .split(path.sep)
      .join('/')
      .replace(/^(?=.)/, '/'),
  breadcrumbParts: () => [],
}));

const { drivesRoutes } = await import('./drives.js');
const { directoryRoutes } = await import('./directory.js');

const husin: NormalizedScopes = {
  allow: ['/j/domains/projects/jeeves-*/**'],
  deny: [],
  explicitAllow: [],
  explicitDeny: [],
};

async function buildApp(scopes: NormalizedScopes | null) {
  const app = Fastify();
  app.addHook('preHandler', (request, _reply, done) => {
    request.accessMode = 'insider';
    request.insiderScopes = scopes;
    done();
  });
  await app.register(drivesRoutes);
  await app.register(directoryRoutes);
  await app.ready();
  return app;
}

function touch(rel: string) {
  const p = path.join(tmpDir, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, 'x');
}

describe('scoped drives and directory listings', () => {
  let app: FastifyInstance;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jeeves-scoped-'));
    touch('domains/projects/jeeves-server/readme.md');
    touch('domains/projects/jeeves-watcher/readme.md');
    touch('domains/projects/vc/secret.md');
    touch('domains/top.md');
    touch('config/secret.json');
  });

  afterEach(async () => {
    await app.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('filters /api/drives to navigable roots', async () => {
    app = await buildApp(husin);
    const res = await app.inject({ url: '/api/drives' });
    expect(res.json()).toEqual([{ letter: 'j', label: 'J:' }]);
  });

  it('lists all drives for unscoped insiders', async () => {
    app = await buildApp(null);
    const res = await app.inject({ url: '/api/drives' });
    expect(res.json()).toHaveLength(2);
  });

  it('shows only ancestor directories at the root', async () => {
    app = await buildApp(husin);
    const res = await app.inject({ url: '/api/path/j' });
    const names = res
      .json<{ entries: { name: string }[] }>()
      .entries.map((e) => e.name);
    expect(names).toEqual(['domains']);
  });

  it('shows wildcard-matched project directories', async () => {
    app = await buildApp(husin);
    const res = await app.inject({ url: '/api/path/j/domains/projects' });
    const names = res
      .json<{ entries: { name: string }[] }>()
      .entries.map((e) => e.name);
    expect(names).toEqual(['jeeves-server', 'jeeves-watcher']);
  });

  it('refuses file metadata outside scope', async () => {
    app = await buildApp(husin);
    const out = await app.inject({ url: '/api/path/j/domains/top.md' });
    expect(out.statusCode).toBe(403);
    const inside = await app.inject({
      url: '/api/path/j/domains/projects/jeeves-server/readme.md',
    });
    expect(inside.statusCode).toBe(200);
  });
});
