/**
 * Tests for matching a routed request to its server catalog entry: by the route Fastify matched, so percent-encoded URLs resolve to the entry they reach, with the decoded `*` value; any other route fails closed.
 *
 * @packageDocumentation
 */

import { SERVER_CATALOG } from '@karmaniverous/jeeves-server-core';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { catalogEntryAt, matchCatalogRequest } from './catalogMatch.js';

describe('catalogEntryAt', () => {
  it.each([
    ['GET', '/status', 'status'],
    ['HEAD', '/status', 'status'],
    ['POST', '/config/apply', 'configApply'],
    ['GET', '/api/path/*', 'browse'],
    ['PUT', '/api/file/*', 'fileWrite'],
    ['GET', '/api/diagram/:type/:hash', 'diagram'],
  ])('%s %s -> %s', (method, url, name) => {
    expect(catalogEntryAt(method, url)).toBe(name);
  });

  it.each([
    ['GET', '/api/search'],
    ['GET', '/browse/*'],
    ['GET', '/api/path/x'],
    ['GET', undefined],
  ])('finds no entry for %s %s', (method, url) => {
    expect(catalogEntryAt(method, url)).toBeUndefined();
  });

  it('has one entry per catalog route', () => {
    for (const entry of SERVER_CATALOG.entries)
      expect(catalogEntryAt(entry.method, entry.path)).toBe(entry.name);
  });
});

describe('matchCatalogRequest', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    app.setErrorHandler((error, _request, reply) =>
      reply.status(500).send({ error: (error as Error).message }),
    );
    await app.register((child, _options, done) => {
      const handler = (request: Parameters<typeof matchCatalogRequest>[0]) =>
        matchCatalogRequest(request);
      child.get('/api/path/*', handler);
      child.get('/config', handler);
      child.post('/config/apply', handler);
      child.get('/api/diagram/:type/:hash', handler);
      child.get('/not-an-entry', handler);
      done();
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it.each([
    ['GET', '/config', { name: 'config' }],
    ['GET', '/%63onfig', { name: 'config' }],
    ['POST', '/%63onfig/%61pply', { name: 'configApply' }],
    ['GET', '/api/diagram/mermaid/%61b', { name: 'diagram' }],
    ['GET', '/api/path/', { name: 'browse', wildcard: '' }],
    ['GET', '/%61pi/path/j/a%20b', { name: 'browse', wildcard: 'j/a b' }],
    ['GET', '/api/path/j%2F..%2Fx', { name: 'browse', wildcard: 'j/../x' }],
    ['GET', '/api/path/j/%2525', { name: 'browse', wildcard: 'j/%25' }],
  ])('%s %s', async (method, url, expected) => {
    const res = await app.inject({
      method: method as 'GET',
      url,
      ...(method === 'POST' ? { payload: {} } : {}),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(expected);
  });

  it('resolves HEAD to the GET entry', async () => {
    const res = await app.inject({ method: 'HEAD', url: '/%63onfig' });
    expect(res.statusCode).toBe(200);
  });

  it('fails closed on a route outside the catalog', async () => {
    const res = await app.inject('/not-an-entry');
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({
      error: 'Route outside the server catalog: GET /not-an-entry',
    });
  });
});
