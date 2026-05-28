/**
 * Tests for deep share link rewriting — fragment handling.
 */

import { describe, expect, it } from 'vitest';

import { rewriteLinksForDeepShare } from './deepShareLinks.js';

const seed = 'test-seed-12345';

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
      expect(result).toMatch(/\?key=.*&amp;d=.*&amp;s=.*#p01-fix/);
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
      expect(result).toMatch(/\?key=.*#section2/);
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
      expect(result).toMatch(/\?key=.*#heading/);
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
      const keyWith = resultWith.match(/key=([a-f0-9]+)/)?.[1];
      const keyWithout = resultWithout.match(/key=([a-f0-9]+)/)?.[1];
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
      expect(result).toMatch(/\?key=/);
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
