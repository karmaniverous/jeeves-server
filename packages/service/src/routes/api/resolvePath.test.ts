/**
 * Tests for the resolve-path endpoint logic.
 *
 * Tests the path resolution and URL construction logic used by
 * GET /api/resolve-path. Exercises fsPathToUrl and getRoots directly
 * since the endpoint is a thin wrapper around those utilities.
 *
 * Platform-aware: Windows auto-discovers drive letters as roots;
 * Linux uses the configured roots map. Tests use platform-native paths.
 */

import { describe, expect, it } from 'vitest';

import { encodeUrlPath, fsPathToUrl, getRoots } from '../../util/platform.js';

const isWindows = process.platform === 'win32';

/**
 * Simulate the endpoint's response construction logic.
 * Mirrors the body of GET /api/resolve-path.
 */
function buildResolveResponse(
  browsePath: string,
  publicUrl: string | undefined,
): Record<string, string> {
  const browseUrl = '/browse/' + encodeUrlPath(browsePath);
  const response: Record<string, string> = { browsePath, browseUrl };
  if (publicUrl) {
    const base = publicUrl.replace(/\/+$/, '');
    response.publicUrl = base + browseUrl;
  }
  return response;
}

// Platform-specific test fixtures
const testRoots = isWindows ? getRoots(undefined) : getRoots({ j: '/srv/j' });
const testFsPath = isWindows
  ? 'J:\\domains\\test.md'
  : '/srv/j/domains/test.md';
const testFsPathSpecial = isWindows
  ? 'J:\\slack\\ax-legal-ip (C0BBG5VH147)\\notes.md'
  : '/srv/j/slack/ax-legal-ip (C0BBG5VH147)/notes.md';
const expectedRootId = 'j';

describe('resolve-path logic', () => {
  it('resolves an absolute path under a known root', () => {
    const urlPath = fsPathToUrl(testFsPath, testRoots);
    expect(urlPath).toContain(expectedRootId + '/');
    expect(urlPath).toContain('test.md');
  });

  it('produces a browsePath without leading slash', () => {
    const urlPath = fsPathToUrl(testFsPath, testRoots);
    const browsePath = urlPath.replace(/^\//, '');

    expect(browsePath).not.toMatch(/^\//);
    expect(browsePath.length).toBeGreaterThan(0);
  });

  it('constructs browseUrl with /browse/ prefix', () => {
    const urlPath = fsPathToUrl(testFsPath, testRoots);
    const browsePath = urlPath.replace(/^\//, '');
    const browseUrl = '/browse/' + browsePath;

    expect(browseUrl).toMatch(/^\/browse\//);
    expect(browseUrl).toContain('test.md');
  });

  it('constructs full public URL when publicUrl is set', () => {
    const urlPath = fsPathToUrl(testFsPath, testRoots);
    const browsePath = urlPath.replace(/^\//, '');
    const browseUrl = '/browse/' + browsePath;

    const publicUrl = 'https://docs.example.com';
    const base = publicUrl.replace(/\/+$/, '');
    const fullUrl = base + browseUrl;

    expect(fullUrl).toMatch(/^https:\/\/docs\.example\.com\/browse\//);
    expect(fullUrl).toContain('test.md');
  });

  it('strips trailing slashes from publicUrl before constructing', () => {
    const base = 'https://docs.example.com///'.replace(/\/+$/, '');
    expect(base).toBe('https://docs.example.com');
  });

  it('omits publicUrl field from response when not configured', () => {
    // Simulate endpoint building a response without publicUrl
    const response = buildResolveResponse('j/test.md', undefined);

    expect(response.publicUrl).toBeUndefined();
    expect(Object.keys(response)).toEqual(['browsePath', 'browseUrl']);
  });

  it('includes publicUrl field when configured', () => {
    const urlPath = fsPathToUrl(testFsPath, testRoots);
    const browsePath = urlPath.replace(/^\//, '');

    const response = buildResolveResponse(
      browsePath,
      'https://docs.example.com',
    );

    expect(response.publicUrl).toBeDefined();
    expect(response.publicUrl).toMatch(
      /^https:\/\/docs\.example\.com\/browse\//,
    );
  });

  it('encodes special characters in browseUrl', () => {
    const urlPath = fsPathToUrl(testFsPathSpecial, testRoots);
    const browsePath = urlPath.replace(/^\//, '');
    const response = buildResolveResponse(
      browsePath,
      'https://docs.example.com',
    );

    // browsePath stays raw
    expect(browsePath).toContain('ax-legal-ip (C0BBG5VH147)');

    // browseUrl has encoded spaces
    expect(response.browseUrl).not.toContain(' ');
    expect(response.browseUrl).toContain('ax-legal-ip%20(C0BBG5VH147)');

    // publicUrl also encoded
    expect(response.publicUrl).not.toContain(' ');
    expect(response.publicUrl).toContain('ax-legal-ip%20(C0BBG5VH147)');
  });
});

describe('encodeUrlPath', () => {
  it('encodes spaces and parentheses', () => {
    expect(encodeUrlPath('j/slack/ax-legal-ip (C0BBG5VH147)/notes.md')).toBe(
      'j/slack/ax-legal-ip%20(C0BBG5VH147)/notes.md',
    );
  });

  it('preserves leading slash', () => {
    expect(encodeUrlPath('/j/test file.md')).toBe('/j/test%20file.md');
  });

  it('leaves clean paths unchanged', () => {
    expect(encodeUrlPath('j/domains/test.md')).toBe('j/domains/test.md');
  });

  it('handles empty segments', () => {
    expect(encodeUrlPath('/j//test.md')).toBe('/j//test.md');
  });
});
