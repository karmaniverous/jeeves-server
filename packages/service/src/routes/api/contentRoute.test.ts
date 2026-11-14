/**
 * Tests for the content path of a request to a catalog entry.
 *
 * @packageDocumentation
 */

import type { ServerEntryName } from '@karmaniverous/jeeves-server-core';
import { describe, expect, it } from 'vitest';

import { routeAccess } from '../../api/routeAccess.js';
import { hasTraversalSegment, parseContentRoute } from './contentRoute.js';

/** The content path of entry `name` with (decoded) `*` value `wildcard`. */
const contentPathOf = (name: ServerEntryName, wildcard?: string) =>
  parseContentRoute({ name, wildcard }, routeAccess(name));

describe('parseContentRoute', () => {
  it.each([
    ['browse', 'j/a', '/j/a'],
    ['fileContent', 'j/a.md', '/j/a.md'],
    ['fileWrite', 'j/a.md', '/j/a.md'],
    ['fileMutate', 'j/a.md', '/j/a.md'],
    ['raw', 'j/a.png', '/j/a.png'],
    ['export', 'j/a.md', '/j/a.md'],
    ['exportCacheClear', 'j/a.md', '/j/a.md'],
    ['exportMermaid', 'j/a.mmd', '/j/a.mmd'],
    ['exportPlantUml', 'j/a.puml', '/j/a.puml'],
    ['linkInfo', 'j/a', '/j/a'],
    ['browse', '', '/'],
    ['browse', undefined, '/'],
    ['fileContent', 'j/my doc.md', '/j/my doc.md'],
    ['fileContent', 'j/%25', '/j/%25'],
    ['drives', undefined, '/'],
  ] as const)('%s %s -> %s', (name, wildcard, path) => {
    expect(contentPathOf(name, wildcard)).toEqual({ path });
  });

  it.each([
    'search',
    'share',
    'resolvePath',
    'runnerGet',
    'authStatus',
    'config',
  ] as const)('returns null for %s, which addresses no content', (name) => {
    expect(contentPathOf(name)).toBeNull();
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
