/**
 * Route tests for PUT /api/file/* (whole-file writes): insider gate,
 * scope enforcement (#271), validation and the write itself.
 *
 * @packageDocumentation
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AccessMode, NormalizedScopes } from '../../config/types.js';

let tmpDir = '';

vi.mock('../../config/index.js', () => ({ getConfig: () => ({ roots: {} }) }));
vi.mock('../../util/platform.js', () => ({
  getRoots: () => [],
  urlPathToFs: (reqPath: string) => {
    const [root, ...rest] = reqPath.split('/');
    return root === 'j' ? path.join(tmpDir, ...rest) : null;
  },
}));

const { fileWriteRoutes } = await import('./fileWrite.js');

const contentScope: NormalizedScopes = {
  allow: ['/j/content/**'],
  deny: [],
  explicitAllow: [],
  explicitDeny: [],
};

async function buildApp(
  accessMode: AccessMode,
  scopes: NormalizedScopes | null = null,
): Promise<FastifyInstance> {
  const app = Fastify();
  app.addHook('preHandler', (request, _reply, done) => {
    request.accessMode = accessMode;
    request.insiderScopes = scopes;
    done();
  });
  await app.register(fileWriteRoutes);
  await app.ready();
  return app;
}

const put = (app: FastifyInstance, url: string, payload: unknown) =>
  app.inject({ method: 'PUT', url, payload: payload as object });

describe('PUT /api/file/*', () => {
  let app: FastifyInstance;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jeeves-write-'));
    fs.mkdirSync(path.join(tmpDir, 'content'));
    fs.mkdirSync(path.join(tmpDir, 'config'));
    fs.writeFileSync(path.join(tmpDir, 'content', 'a.md'), 'old');
    fs.writeFileSync(path.join(tmpDir, 'config', 'x.json'), 'secret');
  });

  afterEach(async () => {
    await app.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const read = (rel: string) => fs.readFileSync(path.join(tmpDir, rel), 'utf8');

  it('rejects outsiders with 403', async () => {
    app = await buildApp('outsider');
    const res = await put(app, '/api/file/j/content/a.md', { content: 'x' });
    expect(res.statusCode).toBe(403);
    expect(read('content/a.md')).toBe('old');
  });

  it('rejects an out-of-scope target with 403 and leaves it untouched', async () => {
    app = await buildApp('insider', contentScope);
    const res = await put(app, '/api/file/j/config/x.json', {
      content: 'pwned',
    });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: 'Path is outside your access scope' });
    expect(read('config/x.json')).toBe('secret');
  });

  it('writes an in-scope file', async () => {
    app = await buildApp('insider', contentScope);
    const res = await put(app, '/api/file/j/content/a.md', {
      content: 'new ✓',
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true, size: 7 });
    expect(read('content/a.md')).toBe('new ✓');
  });

  it.each([
    ['unmapped root', '/api/file/x/a.md', 404],
    ['missing file', '/api/file/j/content/missing.md', 404],
    ['directory', '/api/file/j/content', 400],
  ])('rejects %s', async (_label, url, status) => {
    app = await buildApp('insider');
    const res = await put(app, url, { content: 'x' });
    expect(res.statusCode).toBe(status);
  });

  it('requires string content', async () => {
    app = await buildApp('insider');
    const res = await put(app, '/api/file/j/content/a.md', { content: 42 });
    expect(res.statusCode).toBe(400);
    expect(read('content/a.md')).toBe('old');
  });

  it('reports write failures with 500', async () => {
    app = await buildApp('insider');
    const spy = vi
      .spyOn(fs.promises, 'writeFile')
      .mockRejectedValueOnce(new Error('disk full'));
    const res = await put(app, '/api/file/j/content/a.md', { content: 'x' });
    spy.mockRestore();
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ error: 'Write failed: disk full' });
  });
});
