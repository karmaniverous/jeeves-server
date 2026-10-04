/**
 * Tests for path-level insider scope enforcement helpers.
 *
 * @packageDocumentation
 */

import { describe, expect, it } from 'vitest';

import type { NormalizedScopes } from '../config/types.js';
import {
  archiveEntryFilter,
  canAccessPath,
  canNavigatePath,
  hasTraversalSegment,
  isAncestorOfPattern,
  parseContentRoute,
  scopesAllowRoute,
} from './scopeAccess.js';

const scopes = (s: Partial<NormalizedScopes>): NormalizedScopes => ({
  allow: [],
  deny: [],
  explicitAllow: [],
  explicitDeny: [],
  ...s,
});

const content = scopes({ allow: ['/jeeves/content/**'] });
const jeeves = scopes({ allow: ['/j/domains/projects/jeeves-*/**'] });

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

describe('hasTraversalSegment', () => {
  it.each([
    ['/j/a/../b', true],
    ['/j/a\\..\\b', true],
    ['..', true],
    ['/j/a..b/c', false],
    ['/j/.hidden/x', false],
    ['/j/a/b', false],
  ])('%s → %s', (p, expected) => {
    expect(hasTraversalSegment(p)).toBe(expected);
  });
});

describe('canAccessPath', () => {
  it('allows everything when unscoped', () => {
    expect(canAccessPath('/jeeves/config/secret.json', null)).toBe(true);
    expect(canAccessPath('/jeeves/config/secret.json', undefined)).toBe(true);
  });

  it('allows in-scope paths and denies others', () => {
    expect(canAccessPath('/jeeves/content/a/b.md', content)).toBe(true);
    expect(canAccessPath('/jeeves/config/x.json', content)).toBe(false);
  });

  it('does not grant ancestors', () => {
    expect(canAccessPath('/jeeves', content)).toBe(false);
  });
});

describe('isAncestorOfPattern', () => {
  it.each([
    ['/', '/jeeves/content/**', true],
    ['/jeeves', '/jeeves/content/**', true],
    ['/jeeves/content', '/jeeves/content/**', true],
    ['/jeeves/config', '/jeeves/content/**', false],
    ['/j/domains/projects/jeeves-server', jeeves.allow[0], true],
    ['/j/domains/projects/other', jeeves.allow[0], false],
    ['/j/anything/deep', '/j/**/x.md', true],
    ['/j/a/b/c', '/j/a', false],
    ['/J/Domains', '/j/domains/**', true],
  ])('%s under %s → %s', (dir, pattern, expected) => {
    expect(isAncestorOfPattern(dir, pattern)).toBe(expected);
  });
});

describe('canNavigatePath', () => {
  it('allows ancestors of allowed paths', () => {
    expect(canNavigatePath('/jeeves', content)).toBe(true);
    expect(canNavigatePath('/j/domains/projects', jeeves)).toBe(true);
  });

  it('allows wildcard-matched directories (picomatch alone misses these)', () => {
    expect(canNavigatePath('/j/domains/projects/jeeves-server', jeeves)).toBe(
      true,
    );
  });

  it('denies unrelated directories', () => {
    expect(canNavigatePath('/openclaw', content)).toBe(false);
    expect(canNavigatePath('/j/domains/projects/vc', jeeves)).toBe(false);
  });

  it('denies directories matched by deny', () => {
    const s = scopes({ allow: ['/j/**'], deny: ['/j/secrets/**'] });
    expect(canNavigatePath('/j/secrets', s)).toBe(false);
    expect(canNavigatePath('/j/other', s)).toBe(true);
  });

  it('explicit allow re-opens navigation through a named deny', () => {
    const s = scopes({
      allow: ['/j/**', '/j/p/jill/**'],
      deny: ['/j/p/**'],
      explicitAllow: ['/j/p/jill/**'],
    });
    expect(canNavigatePath('/j/p', s)).toBe(true);
    expect(canNavigatePath('/j/p/jill', s)).toBe(true);
    expect(canNavigatePath('/j/p/other', s)).toBe(false);
  });

  it('explicit deny wins over ancestry', () => {
    const s = scopes({
      allow: ['/j/p/x/**'],
      explicitDeny: ['/j/p/**'],
    });
    expect(canNavigatePath('/j/p', s)).toBe(false);
  });
});

describe('archiveEntryFilter', () => {
  it('includes everything when unscoped', () => {
    expect(archiveEntryFilter('/j', null)('config/secret.json', false)).toBe(
      true,
    );
  });

  it('omits denied entries inside an allowed directory', () => {
    const allow = archiveEntryFilter(
      '/j/',
      scopes({ allow: ['/j/**'], deny: ['/j/secrets/**'] }),
    );
    expect(allow('notes/a.md', false)).toBe(true);
    expect(allow('secrets', true)).toBe(false);
    expect(allow('secrets/key.pem', false)).toBe(false);
    expect(allow('notes\\b.md', false)).toBe(true);
  });
});

describe('scopesAllowRoute', () => {
  it('ignores non-content routes', () => {
    expect(scopesAllowRoute(null, content)).toBe(true);
  });

  it('lets navigation routes reach ancestors', () => {
    expect(
      scopesAllowRoute({ prefix: '/api/path', path: '/jeeves' }, content),
    ).toBe(true);
    expect(
      scopesAllowRoute({ prefix: '/api/link-info', path: '/jeeves' }, content),
    ).toBe(true);
  });

  it('requires content routes to be strictly in scope', () => {
    for (const prefix of [
      '/api/file',
      '/api/raw',
      '/api/export',
      '/api/export-cache',
      '/api/mermaid-export',
      '/api/plantuml-export',
    ] as const) {
      expect(scopesAllowRoute({ prefix, path: '/jeeves' }, content)).toBe(
        false,
      );
      expect(
        scopesAllowRoute({ prefix, path: '/jeeves/config/x.json' }, content),
      ).toBe(false);
      expect(
        scopesAllowRoute({ prefix, path: '/jeeves/content/x.md' }, content),
      ).toBe(true);
    }
  });
});
