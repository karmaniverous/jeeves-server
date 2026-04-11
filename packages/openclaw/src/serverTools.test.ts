import { describe, expect, it } from 'vitest';

import { rewriteUrl, rewriteUrlsInData } from './serverTools.js';

describe('rewriteUrl', () => {
  const baseUrl = 'http://127.0.0.1:1934';
  const publicUrl = 'https://jeeves.johngalt.id';

  it('rewrites a URL that starts with the baseUrl origin', () => {
    expect(
      rewriteUrl(`${baseUrl}/browse/j/docs/readme.md`, baseUrl, publicUrl),
    ).toBe('https://jeeves.johngalt.id/browse/j/docs/readme.md');
  });

  it('preserves query parameters', () => {
    expect(
      rewriteUrl(
        `${baseUrl}/api/export/file.md?format=pdf`,
        baseUrl,
        publicUrl,
      ),
    ).toBe('https://jeeves.johngalt.id/api/export/file.md?format=pdf');
  });

  it('leaves non-matching URLs unchanged', () => {
    expect(
      rewriteUrl('https://other.example.com/path', baseUrl, publicUrl),
    ).toBe('https://other.example.com/path');
  });

  it('handles trailing slashes correctly', () => {
    expect(rewriteUrl(`${baseUrl}/`, baseUrl, publicUrl)).toBe(
      'https://jeeves.johngalt.id/',
    );
  });

  it('handles HTTPS base URL with port', () => {
    const httpsBase = 'https://localhost:8443';
    const pub = 'https://public.example.com';
    expect(rewriteUrl(`${httpsBase}/browse/file.md`, httpsBase, pub)).toBe(
      'https://public.example.com/browse/file.md',
    );
  });

  it('does not rewrite URL when origins differ only by port', () => {
    const base = 'http://127.0.0.1:1934';
    const pub = 'https://jeeves.johngalt.id';
    // URL on port 3000 should NOT be rewritten
    expect(rewriteUrl('http://127.0.0.1:3000/other', base, pub)).toBe(
      'http://127.0.0.1:3000/other',
    );
  });
});

describe('rewriteUrlsInData', () => {
  const baseUrl = 'http://127.0.0.1:1934';
  const publicUrl = 'https://jeeves.johngalt.id';

  it('returns data unchanged when publicUrl is undefined', () => {
    const data = { url: `${baseUrl}/browse/file.md` };
    expect(rewriteUrlsInData(data, baseUrl, undefined)).toEqual(data);
  });

  it('rewrites string values in a flat object', () => {
    const data = {
      pageUrl: `${baseUrl}/browse/j/docs/readme.md?key=abc`,
      rawUrl: `${baseUrl}/raw/j/docs/readme.md?key=abc`,
      path: '/j/docs/readme.md',
    };

    const result = rewriteUrlsInData(data, baseUrl, publicUrl) as typeof data;
    expect(result.pageUrl).toBe(
      'https://jeeves.johngalt.id/browse/j/docs/readme.md?key=abc',
    );
    expect(result.rawUrl).toBe(
      'https://jeeves.johngalt.id/raw/j/docs/readme.md?key=abc',
    );
    expect(result.path).toBe('/j/docs/readme.md');
  });

  it('rewrites URLs in nested objects', () => {
    const data = {
      links: {
        page: `${baseUrl}/browse/file.md`,
        exports: {
          pdf: `${baseUrl}/api/export/file.md?format=pdf`,
        },
      },
    };

    const result = rewriteUrlsInData(data, baseUrl, publicUrl) as {
      links: { page: string; exports: { pdf: string } };
    };
    expect(result.links.page).toBe('https://jeeves.johngalt.id/browse/file.md');
    expect(result.links.exports.pdf).toBe(
      'https://jeeves.johngalt.id/api/export/file.md?format=pdf',
    );
  });

  it('rewrites URLs in arrays', () => {
    const data = [
      `${baseUrl}/browse/a.md`,
      `${baseUrl}/browse/b.md`,
      'not-a-url',
    ];

    const result = rewriteUrlsInData(data, baseUrl, publicUrl) as string[];
    expect(result[0]).toBe('https://jeeves.johngalt.id/browse/a.md');
    expect(result[1]).toBe('https://jeeves.johngalt.id/browse/b.md');
    expect(result[2]).toBe('not-a-url');
  });

  it('handles null and primitive values', () => {
    expect(rewriteUrlsInData(null, baseUrl, publicUrl)).toBeNull();
    expect(rewriteUrlsInData(42, baseUrl, publicUrl)).toBe(42);
    expect(rewriteUrlsInData(true, baseUrl, publicUrl)).toBe(true);
  });

  it('rewrites the server_share response shape', () => {
    const shareResponse = {
      path: '/j/docs/readme.md',
      url: `${baseUrl}/browse/j/docs/readme.md?key=abc123`,
      pageUrl: `${baseUrl}/browse/j/docs/readme.md?key=abc123`,
      rawUrl: `${baseUrl}/raw/j/docs/readme.md?key=abc123`,
      exp: null,
      depth: 0,
      dirs: false,
    };

    const result = rewriteUrlsInData(
      shareResponse,
      baseUrl,
      publicUrl,
    ) as typeof shareResponse;
    expect(result.url).toBe(
      'https://jeeves.johngalt.id/browse/j/docs/readme.md?key=abc123',
    );
    expect(result.pageUrl).toBe(
      'https://jeeves.johngalt.id/browse/j/docs/readme.md?key=abc123',
    );
    expect(result.rawUrl).toBe(
      'https://jeeves.johngalt.id/raw/j/docs/readme.md?key=abc123',
    );
    expect(result.path).toBe('/j/docs/readme.md');
  });
});
