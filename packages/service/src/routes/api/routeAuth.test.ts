/**
 * Route auth tightening: /api/resolve-path needs a machine or insider key,
 * /api/events is only for insiders with no scopes configured, DELETE
 * /api/export-cache is insider-only, public prefixes match whole path
 * segments, and stored event bodies are capped.
 * Real middleware and HMAC keys.
 *
 * @packageDocumentation
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import cookie from '@fastify/cookie';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { COOKIE_NAME, createSessionCookie } from '../../auth/session.js';
import { MAX_STORED_BODY_BYTES } from '../../config/types.js';
import {
  INSIDER_EMAIL,
  INSIDER_SEED,
  MACHINE_SEED,
  makeRuntimeConfig,
  scopes,
} from '../../testing/authFixture.js';
import { computeInsiderKey, computePathKey } from '../../util/crypto.js';
import { storedBody } from '../../util/eventBody.js';

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'route-auth-'));
fs.mkdirSync(path.join(tmpRoot, 'r'), { recursive: true });
fs.writeFileSync(path.join(tmpRoot, 'r', 'a.md'), '# a\n');

const SESSION_SECRET = 's'.repeat(64);
const SCOPED_EMAIL = 'scoped@example.com';
const ALL_SCOPED_EMAIL = 'all-scoped@example.com';
const config = makeRuntimeConfig({
  extraInsiders: [
    {
      email: SCOPED_EMAIL,
      seed: 'scoped-insider-seed-0123456789',
      scopes: scopes(['/r/**']),
      keyCreatedAt: null,
    },
    {
      email: ALL_SCOPED_EMAIL,
      seed: 'all-scoped-insider-seed-0123456789',
      scopes: scopes(['/**']),
      keyCreatedAt: null,
    },
  ],
  overrides: {
    publicUrl: 'https://docs.example.com',
    sessionSecret: SESSION_SECRET,
  },
});
const logEventMock = vi.hoisted(() => vi.fn());

vi.mock('../../config/index.js', () => ({
  getConfig: () => config,
  resetConfig: vi.fn(),
}));
vi.mock('../../services/eventLog.js', () => ({
  logEvent: logEventMock,
  getRecentEvents: () => [{ ts: 't', event: null, matched: false }],
}));
vi.mock('../../services/eventQueue.js', () => ({
  enqueue: vi.fn(),
  appendEvent: vi.fn(),
}));
vi.mock('../../services/exportCache.js', () => ({
  cacheExport: vi.fn(),
  getCachedExport: () => null,
  clearExportCache: () => 0,
  clearDiagramCacheForFile: () => 0,
  clearStandaloneDiagramCache: () => 0,
}));
vi.mock('../../services/diagramCache.js', () => ({
  getDiagramCacheDir: () => tmpRoot,
}));
vi.mock('../../util/platform.js', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getRoots: () => [{ id: 'r', path: path.join(tmpRoot, 'r') }],
  urlPathToFs: (urlPath: string) =>
    path.join(tmpRoot, ...urlPath.replace(/^\/+/u, '').split('/')),
  fsPathToUrl: () => '/r/a.md',
}));

const { addAuthMiddleware, isUnauthenticatedApiPath } =
  await import('./middleware.js');
const { resolvePathRoutes } = await import('./resolvePath.js');
const { eventsRoutes } = await import('./events.js');
const { exportRoutes } = await import('./export.js');
const { eventRoute } = await import('../event.js');

let app: FastifyInstance;

beforeAll(async () => {
  app = Fastify({ bodyLimit: 4 * 1024 * 1024 });
  await app.register(cookie);
  await app.register(async (api) => {
    addAuthMiddleware(api);
    await api.register(resolvePathRoutes);
    await api.register(eventsRoutes);
    await api.register(exportRoutes);
  });
  await app.register(eventRoute);
  await app.ready();
});

afterAll(async () => {
  await app.close();
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

const machineKey = computeInsiderKey(MACHINE_SEED);
const outsiderKey = (p: string) => computePathKey(INSIDER_SEED, p);

describe('public prefix matching', () => {
  it.each([
    ['/api/auth/status', true],
    ['/api/auth/status?path=/x', true],
    ['/api/diagram/abc', true],
    ['/api/auth/statusX', false],
    ['/api/readme-linkX', false],
    ['/api/resolve-path', false],
    ['/api/resolve-pathX', false],
    ['/api/status', false],
  ])('%s -> %s', (url, expected) => {
    expect(isUnauthenticatedApiPath(url)).toBe(expected);
  });
});

describe('GET /api/resolve-path', () => {
  const url = `/api/resolve-path?fsPath=${encodeURIComponent(path.join(tmpRoot, 'r', 'a.md'))}`;

  it('refuses requests without credentials', async () => {
    expect((await app.inject(url)).statusCode).toBe(401);
  });

  it('refuses an outsider key', async () => {
    const res = await app.inject(
      `${url}&k=${outsiderKey('/api/resolve-path')}`,
    );
    expect(res.statusCode).toBe(403);
  });

  it('answers a machine key', async () => {
    const res = await app.inject(`${url}&k=${machineKey}`);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      browsePath: 'r/a.md',
      browseUrl: '/browse/r/a.md',
      publicUrl: 'https://docs.example.com/browse/r/a.md',
    });
  });
});

describe('GET /api/events', () => {
  it('refuses requests without credentials', async () => {
    expect((await app.inject('/api/events')).statusCode).toBe(401);
  });

  it('refuses an outsider key', async () => {
    const res = await app.inject(`/api/events?k=${outsiderKey('/api/events')}`);
    expect(res.statusCode).toBe(403);
  });

  it('answers an unscoped machine key', async () => {
    const res = await app.inject(`/api/events?k=${machineKey}`);
    expect(res.statusCode).toBe(200);
    expect(res.json<unknown[]>()).toHaveLength(1);
  });

  /** GET /api/events with an insider session for `email`. */
  const withSession = (email: string) =>
    app.inject({
      url: '/api/events',
      cookies: { [COOKIE_NAME]: createSessionCookie(email, SESSION_SECRET) },
    });

  it('answers an insider session with no scopes configured', async () => {
    expect(config.resolvedInsiders[0]?.scopes).toBeNull();
    expect((await withSession(INSIDER_EMAIL)).statusCode).toBe(200);
  });

  // Strict rule: any configured scopes refuse, even ones that allow everything.
  it.each([
    ['a path-scoped insider session', SCOPED_EMAIL],
    ["an insider session scoped to allow '/**'", ALL_SCOPED_EMAIL],
  ])('refuses %s', async (_label, email) => {
    const res = await withSession(email);
    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: 'Unscoped insider access required' });
  });
});

describe('DELETE /api/export-cache', () => {
  it('refuses an outsider share key for the file', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/export-cache/r/a.md?k=${outsiderKey('/r/a.md')}`,
    });
    expect(res.statusCode).toBe(403);
  });

  it('lets an insider clear the cache', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/export-cache/r/a.md?k=${machineKey}`,
    });
    expect(res.statusCode).toBe(200);
  });
});

describe('stored event bodies', () => {
  it('keeps bodies up to the cap untouched', () => {
    expect(storedBody('{"a":1}')).toEqual({ bodyPreview: '{"a":1}' });
  });

  it('truncates bodies over the cap and records the original length', () => {
    const json = JSON.stringify({ data: 'x'.repeat(MAX_STORED_BODY_BYTES) });
    const stored = storedBody(json);
    expect(stored.truncated).toBe(true);
    expect(stored.originalBytes).toBe(Buffer.byteLength(json));
    expect(Buffer.byteLength(stored.bodyPreview ?? '')).toBe(
      MAX_STORED_BODY_BYTES,
    );
  });

  it('never splits a multi-byte character at the cap', () => {
    const stored = storedBody('ab\u00e9', 3);
    expect(stored).toEqual({
      bodyPreview: 'ab',
      truncated: true,
      originalBytes: 4,
    });
  });

  it('logs an unmatched 300 KiB webhook body capped at 256 KiB', async () => {
    const payload = { blob: 'y'.repeat(300 * 1024) };
    const res = await app.inject({
      method: 'POST',
      url: `/event?k=${computePathKey(MACHINE_SEED, '/event')}`,
      payload,
    });
    expect(res.statusCode).toBe(200);
    const entry = logEventMock.mock.calls[0]?.[0] as {
      bodyPreview: string;
      truncated: boolean;
      originalBytes: number;
    };
    expect(entry.truncated).toBe(true);
    expect(entry.originalBytes).toBe(
      Buffer.byteLength(JSON.stringify(payload)),
    );
    expect(Buffer.byteLength(entry.bodyPreview)).toBe(256 * 1024);
  });
});
