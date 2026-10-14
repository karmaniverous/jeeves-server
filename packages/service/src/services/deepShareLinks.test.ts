/**
 * Tests for deep share link rewriting (fragment handling) and the deep
 * share context helpers.
 */

import { describe, expect, it } from 'vitest';

import {
  canListDirectory,
  encodeStack,
  rewriteLinksForDeepShare,
  toDeepShareContext,
} from './deepShareLinks.js';

const seed = 'test-seed-12345';

describe('toDeepShareContext', () => {
  it('parses depth and dirs and carries the stack and exp', () => {
    expect(toDeepShareContext({ d: '3', dirs: '1', s: 'STK' }, '9')).toEqual({
      maxDepth: 3,
      dirs: true,
      stackCompressed: 'STK',
      exp: '9',
    });
  });

  it.each(['', 'x'])('treats depth %j as 0', (d) => {
    expect(toDeepShareContext({ d, dirs: '0', s: '' }, undefined)).toEqual({
      maxDepth: 0,
      dirs: false,
      stackCompressed: '',
      exp: undefined,
    });
  });

  it('accepts only dirs=1 as dirs', () => {
    expect(
      toDeepShareContext({ d: '1', dirs: 'true', s: '' }, undefined).dirs,
    ).toBe(false);
  });
});

describe('canListDirectory', () => {
  const context = (dirs: boolean, stack: string[]) => ({
    maxDepth: 2,
    dirs,
    stackCompressed: encodeStack(stack),
    exp: undefined,
  });

  it('lets a dirs share list any directory it reaches', () => {
    expect(
      canListDirectory(context(true, ['/r/a.md', '/r/sub']), '/r/sub'),
    ).toBe(true);
  });

  it('without dirs, lists only the shared directory itself (any case)', () => {
    expect(canListDirectory(context(false, ['/r/Docs']), '/r/docs')).toBe(true);
  });

  it('without dirs, refuses a directory reached by a hop', () => {
    expect(
      canListDirectory(context(false, ['/r/a.md', '/r/sub']), '/r/sub'),
    ).toBe(false);
  });

  it('without dirs, refuses another directory and an empty stack', () => {
    expect(canListDirectory(context(false, ['/r/docs']), '/r/other')).toBe(
      false,
    );
    expect(canListDirectory(context(false, []), '/r/docs')).toBe(false);
  });
});

describe('rewriteLinksForDeepShare', () => {
  describe('fragment handling', () => {
    it('should place fragment after query params for relative links', () => {
      const html = '<a href="Analysis.md#p01-fix">Link</a>';
      const result = rewriteLinksForDeepShare(
        html,
        seed,
        '/repo/README.md',
        2,
        false,
        '',
        undefined,
      );
      // Fragment must come after all query params (cheerio encodes & as &amp;)
      expect(result).toMatch(/\?k=.*&amp;d=.*&amp;s=.*#p01-fix/);
      // Must NOT have #fragment before ?
      expect(result).not.toMatch(/#p01-fix\?/);
    });

    it('should place fragment after query params for absolute /browse/ links', () => {
      const html = '<a href="/browse/repo/Analysis.md#section2">Link</a>';
      const result = rewriteLinksForDeepShare(
        html,
        seed,
        '/repo/README.md',
        2,
        false,
        '',
        undefined,
      );
      expect(result).toMatch(/\?k=.*#section2/);
      expect(result).not.toMatch(/#section2\?/);
    });

    it('should place fragment after query params for absolute / links', () => {
      const html = '<a href="/repo/Analysis.md#heading">Link</a>';
      const result = rewriteLinksForDeepShare(
        html,
        seed,
        '/repo/README.md',
        2,
        false,
        '',
        undefined,
      );
      expect(result).toMatch(/\?k=.*#heading/);
      expect(result).not.toMatch(/#heading\?/);
    });

    it('should not include fragment in the target path used for key computation', () => {
      const htmlWithFragment = '<a href="Analysis.md#frag">Link</a>';
      const htmlWithout = '<a href="Analysis.md">Link</a>';

      const resultWith = rewriteLinksForDeepShare(
        htmlWithFragment,
        seed,
        '/repo/README.md',
        2,
        false,
        '',
        undefined,
      );
      const resultWithout = rewriteLinksForDeepShare(
        htmlWithout,
        seed,
        '/repo/README.md',
        2,
        false,
        '',
        undefined,
      );

      // Extract key from both — should be identical since fragment is not part of path
      const keyWith = resultWith.match(/[?&]k=([a-f0-9]+)/)?.[1];
      const keyWithout = resultWithout.match(/[?&]k=([a-f0-9]+)/)?.[1];
      expect(keyWith).toBe(keyWithout);
    });

    it('should work correctly for links without fragments', () => {
      const html = '<a href="Analysis.md">Link</a>';
      const result = rewriteLinksForDeepShare(
        html,
        seed,
        '/repo/README.md',
        2,
        false,
        '',
        undefined,
      );
      expect(result).toMatch(/\?k=/);
      expect(result).not.toContain('#');
    });

    it('should leave pure anchor links unchanged', () => {
      const html = '<a href="#section">Link</a>';
      const result = rewriteLinksForDeepShare(
        html,
        seed,
        '/repo/README.md',
        2,
        false,
        '',
        undefined,
      );
      expect(result).toBe('<a href="#section">Link</a>');
    });

    it('should handle fragment with exp parameter', () => {
      const html = '<a href="Analysis.md#frag">Link</a>';
      const result = rewriteLinksForDeepShare(
        html,
        seed,
        '/repo/README.md',
        2,
        false,
        '',
        '2099-01-01',
      );
      // exp should come before fragment (cheerio encodes & as &amp;)
      expect(result).toMatch(/&amp;exp=2099-01-01#frag/);
    });
  });
});
