/**
 * Tests for matching requests to server catalog entries.
 *
 * @packageDocumentation
 */

import { SERVER_CATALOG } from '@karmaniverous/jeeves-server-core';
import { describe, expect, it } from 'vitest';

import { compileRoutePath, matchCatalogRoute } from './catalogMatch.js';

describe('matchCatalogRoute', () => {
  it.each([
    ['GET', '/status', { name: 'status' }],
    ['HEAD', '/status', { name: 'status' }],
    ['GET', '/config?path=$.port', { name: 'config' }],
    ['POST', '/config/apply', { name: 'configApply' }],
    ['GET', '/key?path=/x', { name: 'pathKey' }],
    ['POST', '/event?k=x', { name: 'receiveEvent' }],
    ['POST', '/api/search', { name: 'search' }],
    ['GET', '/api/search/facets', { name: 'searchFacets' }],
    ['GET', '/api/path/j/a%20b', { name: 'browse', wildcard: 'j/a%20b' }],
    ['GET', '/api/path', { name: 'browse', wildcard: '' }],
    ['PUT', '/api/file/j/a.md', { name: 'fileWrite', wildcard: 'j/a.md' }],
    ['POST', '/api/file/j/a.md', { name: 'fileMutate', wildcard: 'j/a.md' }],
    [
      'DELETE',
      '/api/export-cache/j/a.md',
      { name: 'exportCacheClear', wildcard: 'j/a.md' },
    ],
    ['GET', '/api/export/j/a.md', { name: 'export', wildcard: 'j/a.md' }],
    ['GET', '/api/diagram/mermaid/abc', { name: 'diagram' }],
    ['GET', '/api/content-link/terms', { name: 'contentLink' }],
    ['POST', '/api/util/share-for', { name: 'shareFor' }],
    [
      'POST',
      '/api/runner/jobs/a/run',
      { name: 'runnerPost', wildcard: 'jobs/a/run' },
    ],
  ])('%s %s', (method, url, expected) => {
    expect(matchCatalogRoute(method, url)).toEqual(expected);
  });

  it.each([
    ['GET', '/api/search'],
    ['GET', '/api/export-cache/j/a.md'],
    ['GET', '/api/diagram/mermaid'],
    ['GET', '/api/auth/statusX'],
    ['GET', '/api/paths/x'],
    ['POST', '/rotate-key'],
    ['GET', '/share'],
    ['GET', '/browse/j/a.md'],
    ['GET', '/api/drives/'],
  ])('matches no entry for %s %s', (method, url) => {
    expect(matchCatalogRoute(method, url)).toBeNull();
  });

  it('matches each request to at most one entry', () => {
    const patterns = SERVER_CATALOG.entries.map((e) => ({
      method: e.method,
      pattern: compileRoutePath(e.path),
    }));
    for (const entry of SERVER_CATALOG.entries) {
      const sample = entry.path.replace(/:[^/]+/gu, 'x').replace('*', 'y/z');
      const hits = patterns.filter(
        (p) => p.method === entry.method && p.pattern.test(sample),
      );
      expect(hits, `${entry.method} ${sample}`).toHaveLength(1);
    }
  });
});
