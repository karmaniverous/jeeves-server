// @vitest-environment node
/**
 * The access hook through the real app (`registerServerApp`): every catalog entry refuses a request without credentials (public entries excepted), also when every path segment is percent-encoded, since the entry comes from the route Fastify matched, not the raw URL; encoded `..` segments are refused before any credential, over real HTTP too; body and query paths with `..` are refused.
 *
 * @packageDocumentation
 */

import http from 'node:http';
import type { AddressInfo } from 'node:net';

import { SERVER_CATALOG } from '@karmaniverous/jeeves-server-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { startWireApp, type WireApp } from '../test/wire/wireApp.js';
import { credentialFor } from '../test/wire/wireCredentials.js';
import { routeAccess } from './routeAccess.js';

let wire: WireApp;

beforeAll(async () => {
  wire = await startWireApp();
});

afterAll(async () => {
  await wire.close();
});

/** The content root's URL path without its leading slash. */
const root = () => wire.rootUrl.slice(1);

/** A URL for an entry: parameters filled, `*` a private file. */
const sampleUrl = (path: string) =>
  path.replace(/:[^/]+/gu, 'x').replace(/\*$/u, `${root()}/private/secret.md`);

/** Percent-encode the first character of every path segment. */
const encodeSegments = (url: string) =>
  url.replace(
    /\/([0-9A-Za-z])/gu,
    (_m, c: string) => `/%${c.charCodeAt(0).toString(16)}`,
  );

const ENTRIES = SERVER_CATALOG.entries.map((entry) => ({
  name: entry.name,
  method: entry.method,
  path: entry.path,
  class: routeAccess(entry.name).class,
}));

const send = (method: string, url: string) =>
  wire.app.inject({
    method: method as 'GET',
    url,
    ...(method === 'GET' || method === 'DELETE' ? {} : { payload: {} }),
  });

describe('every catalog entry, without credentials', () => {
  const guarded = ENTRIES.filter((e) => e.class !== 'public');
  const open = ENTRIES.filter((e) => e.class === 'public');

  it.each(guarded)('$name ($class) refuses $method $path', async (e) => {
    const plain = sampleUrl(e.path);
    for (const url of [plain, encodeSegments(plain)]) {
      const res = await send(e.method, url);
      expect([url, res.statusCode]).toEqual([url, 401]);
      expect(res.json<{ code: string }>().code).toBe('SERVER_UNAUTHORIZED');
    }
  });

  it.each(open)('$name (public) is never refused', async (e) => {
    const plain = sampleUrl(e.path);
    for (const url of [plain, encodeSegments(plain)]) {
      const res = await send(e.method, url);
      expect([url, [401, 403].includes(res.statusCode)]).toEqual([url, false]);
    }
  });

  it.each([
    ['GET', '/%63onfig'],
    ['POST', '/%63onfig/apply'],
    ['POST', '/%63onfig/%61pply'],
    ['GET', '/api/%65vents'],
    ['GET', '/%61pi/%65vents'],
  ])('%s %s is refused as the entry it reaches', async (method, url) => {
    const res = await send(method, url);
    expect(res.statusCode).toBe(401);
    expect(res.json<{ code: string }>().code).toBe('SERVER_UNAUTHORIZED');
  });

  it('refuses /%61pi/file on a private file', async () => {
    const res = await send('GET', `/%61pi/file/${root()}/private/secret.md`);
    expect(res.statusCode).toBe(401);
    expect(res.body).not.toContain('Secret');
  });
});

describe('.. segments', () => {
  it.each(['raw', 'file', 'path', 'export'])(
    'refuses an encoded .. on /api/%s before any credential',
    async (route) => {
      const res = await send(
        'GET',
        `/%61pi/${route}/${root()}/public%2F%2e%2e%2Fprivate/secret.md`,
      );
      expect(res.statusCode).toBe(400);
      expect(res.json<{ code: string }>().code).toBe('SERVER_INVALID_PATH');
    },
  );

  it('refuses /%61pi/raw/<root>/%2e%2e/... over real HTTP', async () => {
    await wire.app.listen({ port: 0, host: '127.0.0.1' });
    const { port } = wire.app.server.address() as AddressInfo;
    const last = root().split('/').at(-1) ?? '';
    const reply = await new Promise<{ status: number; body: string }>(
      (resolve, reject) => {
        http
          .get(
            {
              host: '127.0.0.1',
              port,
              path: `/%61pi/raw/${root()}/%2e%2e/${last}/private/secret.md`,
            },
            (res) => {
              let body = '';
              res.on('data', (chunk: Buffer) => (body += chunk.toString()));
              res.on('end', () => {
                resolve({ status: res.statusCode ?? 0, body });
              });
            },
          )
          .on('error', reject);
      },
    );
    expect(reply.status).toBe(400);
    expect(reply.body).toContain('SERVER_INVALID_PATH');
  });

  const session = () => credentialFor({ session: 'admin' }, wire).headers;

  it.each([
    ['share', '/api/share', { path: '' }],
    ['shareFor', '/api/util/share-for', { path: '', insiders: [] }],
  ])('%s refuses a body path with ..', async (_name, url, body) => {
    const res = await wire.app.inject({
      method: 'POST',
      url,
      headers: session(),
      payload: { ...body, path: `/${root()}/public/../private/secret.md` },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json<{ code: string }>().code).toBe('SERVER_INVALID_PATH');
  });

  it('resolvePath refuses an fsPath with ..', async () => {
    const fsPath = `${wire.contentDir}/public/../private/secret.md`;
    const res = await wire.app.inject({
      url: `/api/resolve-path?fsPath=${encodeURIComponent(fsPath)}`,
      headers: session(),
    });
    expect(res.statusCode).toBe(400);
    expect(res.json<{ code: string }>().code).toBe('SERVER_INVALID_PATH');
  });
});
