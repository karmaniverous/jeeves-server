/**
 * Tests for scope override precedence in key verification.
 *
 * Verifies the three-tier evaluation order:
 * 1. explicitDeny → DENIED (overrides named allow)
 * 2. explicitAllow → ALLOWED (overrides named deny)
 * 3. Standard allow AND NOT deny
 */

import { describe, expect, it } from 'vitest';

import { _pathMatchesScopes as pathMatchesScopes } from './keys.js';

describe('pathMatchesScopes', () => {
  it('allows a path matching allow and not deny', () => {
    expect(
      pathMatchesScopes('/d/projects/foo', {
        allow: ['/d/projects/**'],
        deny: [],
        explicitAllow: [],
        explicitDeny: [],
      }),
    ).toBe(true);
  });

  it('denies a path not matching any allow', () => {
    expect(
      pathMatchesScopes('/d/secrets/foo', {
        allow: ['/d/projects/**'],
        deny: [],
        explicitAllow: [],
        explicitDeny: [],
      }),
    ).toBe(false);
  });

  it('denies a path matching a deny pattern', () => {
    expect(
      pathMatchesScopes('/d/projects/secret/foo', {
        allow: ['/d/projects/**'],
        deny: ['/d/projects/secret/**'],
        explicitAllow: [],
        explicitDeny: [],
      }),
    ).toBe(false);
  });

  it('explicit allow overrides named deny', () => {
    expect(
      pathMatchesScopes('/j/domains/projects/jill/doc.md', {
        allow: ['/j/domains/projects/**'],
        deny: ['/j/domains/projects/jill/**'],
        explicitAllow: ['/j/domains/projects/jill/**'],
        explicitDeny: [],
      }),
    ).toBe(true);
  });

  it('explicit deny overrides named allow', () => {
    expect(
      pathMatchesScopes('/d/repos/secret/code.ts', {
        allow: ['/d/repos/**'],
        deny: [],
        explicitAllow: [],
        explicitDeny: ['/d/repos/secret/**'],
      }),
    ).toBe(false);
  });

  it('explicit deny takes precedence over explicit allow', () => {
    expect(
      pathMatchesScopes('/d/repos/secret/code.ts', {
        allow: ['/d/repos/**'],
        deny: [],
        explicitAllow: ['/d/repos/secret/**'],
        explicitDeny: ['/d/repos/secret/**'],
      }),
    ).toBe(false);
  });

  it('path not in any scope is denied even with explicit allow on different path', () => {
    expect(
      pathMatchesScopes('/totally/elsewhere', {
        allow: ['/d/projects/**'],
        deny: [],
        explicitAllow: ['/j/domains/projects/jill/**'],
        explicitDeny: [],
      }),
    ).toBe(false);
  });

  it('Robert/Jill scenario: projects + no-private + explicit jill allow', () => {
    // Named scopes: projects (allow /j/domains/projects/**) + no-private (deny /j/domains/projects/jill/**)
    // Explicit: allow /j/domains/projects/jill/**
    const scopes = {
      allow: ['/j/domains/projects/**'],
      deny: ['/j/domains/projects/jill/**'],
      explicitAllow: ['/j/domains/projects/jill/**'],
      explicitDeny: [],
    };

    // Jill's project should be accessible (explicit allow overrides named deny)
    expect(
      pathMatchesScopes('/j/domains/projects/jill/thesis.md', scopes),
    ).toBe(true);

    // Other projects should work normally
    expect(
      pathMatchesScopes('/j/domains/projects/jeeves-server/readme.md', scopes),
    ).toBe(true);

    // Other private projects (if they existed) would still be denied
    // (only jill is explicitly allowed)
  });
});
