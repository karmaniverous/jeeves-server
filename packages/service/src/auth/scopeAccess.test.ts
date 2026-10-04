/**
 * Tests for path-level insider scope decisions.
 *
 * @packageDocumentation
 */

import { describe, expect, it } from 'vitest';

import type { NormalizedScopes } from '../config/types.js';
import {
  canAccessPath,
  canNavigatePath,
  isAncestorOfPattern,
  scopedEntryFilter,
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

describe('canAccessPath', () => {
  it('treats null/undefined scopes as unrestricted', () => {
    expect(canAccessPath('/jeeves/config/secret.json', null)).toBe(true);
    expect(canAccessPath('/jeeves/config/secret.json', undefined)).toBe(true);
  });

  it('allows in-scope paths and denies others, including ancestors', () => {
    expect(canAccessPath('/jeeves/content/a/b.md', content)).toBe(true);
    expect(canAccessPath('/jeeves/config/x.json', content)).toBe(false);
    expect(canAccessPath('/jeeves', content)).toBe(false);
  });
});

describe('isAncestorOfPattern', () => {
  it.each([
    ['/', '/jeeves/content/**', true],
    ['/jeeves', '/jeeves/content/**', true],
    ['/jeeves/content', '/jeeves/content/**', true],
    ['/jeeves/config', '/jeeves/content/**', false],
    [
      '/j/domains/projects/jeeves-server',
      '/j/domains/projects/jeeves-*/**',
      true,
    ],
    ['/j/domains/projects/other', '/j/domains/projects/jeeves-*/**', false],
    ['/j/anything/deep', '/j/**/x.md', true],
    ['/j/a/b/c', '/j/a', false],
    ['/J/Domains', '/j/domains/**', true],
  ])('%s under %s → %s', (dir, pattern, expected) => {
    expect(isAncestorOfPattern(dir, pattern)).toBe(expected);
  });
});

describe('canNavigatePath', () => {
  it('treats null scopes as unrestricted', () => {
    expect(canNavigatePath('/anything', null)).toBe(true);
  });

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

  it('denies ancestors matched by deny', () => {
    const s = scopes({ allow: ['/j/x/y/**'], deny: ['/j/x/**'] });
    expect(canNavigatePath('/j/x', s)).toBe(false);
    expect(canNavigatePath('/j', s)).toBe(true);
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
    const s = scopes({ allow: ['/j/p/x/**'], explicitDeny: ['/j/p/**'] });
    expect(canNavigatePath('/j/p', s)).toBe(false);
  });
});

describe('scopedEntryFilter', () => {
  it('includes everything when unscoped', () => {
    expect(scopedEntryFilter('/j', null)('config/secret.json', false)).toBe(
      true,
    );
  });

  it('omits denied files and directories inside an allowed directory', () => {
    const include = scopedEntryFilter(
      '/j/',
      scopes({ allow: ['/j/**'], deny: ['/j/secrets/**'] }),
    );
    expect(include('notes/a.md', false)).toBe(true);
    expect(include('notes\\b.md', false)).toBe(true);
    expect(include('secrets', true)).toBe(false);
    expect(include('secrets/key.pem', false)).toBe(false);
  });

  it('keeps navigable directories that lead to allowed content', () => {
    const include = scopedEntryFilter('/j', jeeves);
    expect(include('domains/projects', true)).toBe(true);
    expect(include('domains/top.md', false)).toBe(false);
  });
});
