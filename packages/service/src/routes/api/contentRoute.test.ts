/**
 * Tests for API URL → content path mapping.
 *
 * @packageDocumentation
 */

import { describe, expect, it } from 'vitest';

import {
  hasTraversalSegment,
  isNavigationRoute,
  keyAuthPath,
  parseContentRoute,
} from './contentRoute.js';

describe('parseContentRoute', () => {
  it.each([
    ['/api/path/j/a', '/api/path', '/j/a'],
    ['/api/file/j/a.md?raw=1', '/api/file', '/j/a.md'],
    ['/api/raw/j/a.png', '/api/raw', '/j/a.png'],
    ['/api/export/j/a.md?format=pdf', '/api/export', '/j/a.md'],
    ['/api/export-cache/j/a.md', '/api/export-cache', '/j/a.md'],
    ['/api/mermaid-export/j/a.mmd', '/api/mermaid-export', '/j/a.mmd'],
    ['/api/plantuml-export/j/a.puml', '/api/plantuml-export', '/j/a.puml'],
    ['/api/link-info/j/a', '/api/link-info', '/j/a'],
    ['/api/path', '/api/path', '/'],
    ['/api/file/j/my%20doc.md', '/api/file', '/j/my doc.md'],
  ])('%s → %s %s', (url, prefix, path) => {
    expect(parseContentRoute(url)).toEqual({ prefix, path });
  });

  it.each(['/api/drives', '/api/search', '/api/share', '/api/paths/x'])(
    'returns null for non-content route %s',
    (url) => {
      expect(parseContentRoute(url)).toBeNull();
    },
  );

  it('falls back to the raw path on malformed encoding', () => {
    expect(parseContentRoute('/api/raw/j/%E0%A4%A')?.path).toBe('/j/%E0%A4%A');
  });
});

describe('keyAuthPath', () => {
  it('uses the content path for content routes', () => {
    const url = '/api/mermaid-export/j/a.mmd?key=k';
    expect(keyAuthPath(url, parseContentRoute(url))).toBe('/j/a.mmd');
  });

  it('maps /api/drives to the root', () => {
    expect(keyAuthPath('/api/drives?key=k', null)).toBe('/');
  });

  it('uses the decoded request path for other routes', () => {
    expect(keyAuthPath('/api/search%20x?key=k', null)).toBe('/api/search x');
  });
});

describe('isNavigationRoute', () => {
  it.each([
    ['/api/path', true],
    ['/api/link-info', true],
    ['/api/file', false],
    ['/api/raw', false],
    ['/api/export', false],
  ] as const)('%s → %s', (prefix, expected) => {
    expect(isNavigationRoute({ prefix, path: '/j' })).toBe(expected);
  });
});

describe('hasTraversalSegment', () => {
  it.each([
    ['/j/a/../b', true],
    ['/j/a\\..\\b', true],
    ['..', true],
    ['/j/a..b/c', false],
    ['/j/.hidden/x', false],
  ])('%s → %s', (p, expected) => {
    expect(hasTraversalSegment(p)).toBe(expected);
  });
});
