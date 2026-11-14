/**
 * Tests for the content path of a request to a catalog entry.
 *
 * @packageDocumentation
 */

import { describe, expect, it } from 'vitest';

import { matchCatalogRoute } from '../../api/catalogMatch.js';
import { routeAccess } from '../../api/routeAccess.js';
import { hasTraversalSegment, parseContentRoute } from './contentRoute.js';

/** The content path of `method url`, through the catalog. */
const contentPathOf = (method: string, url: string) => {
  const match = matchCatalogRoute(method, url);
  return match ? parseContentRoute(match, routeAccess(match.name)) : null;
};

describe('parseContentRoute', () => {
  it.each([
    ['GET', '/api/path/j/a', '/j/a'],
    ['GET', '/api/file/j/a.md?raw=1', '/j/a.md'],
    ['PUT', '/api/file/j/a.md', '/j/a.md'],
    ['POST', '/api/file/j/a.md', '/j/a.md'],
    ['GET', '/api/raw/j/a.png', '/j/a.png'],
    ['GET', '/api/export/j/a.md?format=pdf', '/j/a.md'],
    ['DELETE', '/api/export-cache/j/a.md', '/j/a.md'],
    ['GET', '/api/mermaid-export/j/a.mmd', '/j/a.mmd'],
    ['GET', '/api/plantuml-export/j/a.puml', '/j/a.puml'],
    ['GET', '/api/link-info/j/a', '/j/a'],
    ['GET', '/api/path', '/'],
    ['GET', '/api/path/', '/'],
    ['GET', '/api/file/j/my%20doc.md', '/j/my doc.md'],
    ['GET', '/api/drives', '/'],
  ])('%s %s -> %s', (method, url, path) => {
    expect(contentPathOf(method, url)).toEqual({ path });
  });

  it.each([
    ['POST', '/api/search'],
    ['POST', '/api/share'],
    ['GET', '/api/resolve-path'],
    ['GET', '/api/runner/jobs'],
    ['GET', '/api/auth/status'],
    ['GET', '/config'],
  ])('returns null for %s %s, which addresses no content', (method, url) => {
    expect(contentPathOf(method, url)).toBeNull();
  });

  it('falls back to the raw path on malformed encoding', () => {
    expect(contentPathOf('GET', '/api/raw/j/%E0%A4%A')?.path).toBe(
      '/j/%E0%A4%A',
    );
  });
});

describe('hasTraversalSegment', () => {
  it.each([
    ['/j/a/../b', true],
    ['/j/a\\..\\b', true],
    ['..', true],
    ['/j/a..b/c', false],
    ['/j/.hidden/x', false],
  ])('%s -> %s', (p, expected) => {
    expect(hasTraversalSegment(p)).toBe(expected);
  });
});
