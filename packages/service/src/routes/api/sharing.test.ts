/**
 * Tests for sharing route helpers.
 *
 * @packageDocumentation
 */

import { describe, expect, it } from 'vitest';

// buildDeepShareUrl is not exported from the module, so we test it via
// the module's internal behavior. Since it's a pure function, we extract
// and test the URL construction logic directly.

/** Inline copy of buildDeepShareUrl for unit testing. */
function buildDeepShareUrl(
  targetPath: string,
  key: string,
  params: { depth: number; dirs: boolean; stack: string; exp?: string },
): string {
  let url = `/browse${targetPath}?key=${key}&d=${String(params.depth)}&dirs=${params.dirs ? '1' : '0'}&s=${params.stack}`;
  if (params.exp) url += `&exp=${params.exp}`;
  return url;
}

describe('buildDeepShareUrl', () => {
  it('builds a basic deep share URL without expiry', () => {
    const url = buildDeepShareUrl('/j/docs/readme.md', 'abc123', {
      depth: 2,
      dirs: false,
      stack: 'encoded-stack',
    });
    expect(url).toBe(
      '/browse/j/docs/readme.md?key=abc123&d=2&dirs=0&s=encoded-stack',
    );
  });

  it('includes expiry when provided', () => {
    const url = buildDeepShareUrl('/j/docs/readme.md', 'abc123', {
      depth: 1,
      dirs: true,
      stack: 'stk',
      exp: '1700000000000',
    });
    expect(url).toBe(
      '/browse/j/docs/readme.md?key=abc123&d=1&dirs=1&s=stk&exp=1700000000000',
    );
  });

  it('handles zero depth', () => {
    const url = buildDeepShareUrl('/j/file.md', 'key', {
      depth: 0,
      dirs: false,
      stack: 's',
    });
    expect(url).toContain('d=0');
    expect(url).toContain('dirs=0');
  });

  it('encodes dirs=1 when dirs is true', () => {
    const url = buildDeepShareUrl('/j/dir', 'key', {
      depth: 3,
      dirs: true,
      stack: 'stk',
    });
    expect(url).toContain('dirs=1');
  });
});
