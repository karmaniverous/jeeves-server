/**
 * Public origin: it comes from publicUrl; request headers are
 * trusted only with trustProxyHeaders, and are validated even then.
 *
 * @packageDocumentation
 */

import { describe, expect, it } from 'vitest';

import { getPublicOrigin, isSecureOrigin } from './publicOrigin.js';

const forged = {
  headers: {
    host: 'evil.example',
    'x-forwarded-host': 'evil.example',
    'x-forwarded-proto': 'https',
  },
  hostname: 'evil.example',
  protocol: 'https',
};

describe('getPublicOrigin', () => {
  it('uses publicUrl and ignores forged headers', () => {
    expect(
      getPublicOrigin(
        { publicUrl: 'https://docs.example.com/', trustProxyHeaders: true },
        forged,
      ),
    ).toBe('https://docs.example.com');
  });

  it('keeps a publicUrl path prefix without the trailing slash', () => {
    expect(
      getPublicOrigin(
        { publicUrl: 'https://example.com/jeeves/', trustProxyHeaders: false },
        forged,
      ),
    ).toBe('https://example.com/jeeves');
  });

  it('returns null without publicUrl unless headers are trusted', () => {
    expect(getPublicOrigin({ trustProxyHeaders: false }, forged)).toBeNull();
  });

  it('uses the first forwarded values when headers are trusted', () => {
    expect(
      getPublicOrigin(
        { trustProxyHeaders: true },
        {
          headers: {
            host: 'internal:1934',
            'x-forwarded-host': 'proxy.example.com, other.example',
            'x-forwarded-proto': 'https, http',
          },
        },
      ),
    ).toBe('https://proxy.example.com');
  });

  it('falls back to Host and the request protocol when trusted', () => {
    expect(
      getPublicOrigin(
        { trustProxyHeaders: true },
        { headers: { host: 'localhost:1934' }, protocol: 'http' },
      ),
    ).toBe('http://localhost:1934');
  });

  it.each([
    ['a non-http scheme', { 'x-forwarded-proto': 'gopher', host: 'a.example' }],
    ['a javascript scheme', { 'x-forwarded-proto': 'javascript', host: 'a' }],
    ['a host with a path', { host: 'evil.example/@x' }],
    ['a host with credentials', { host: 'user@evil.example' }],
    ['a host with spaces', { host: 'evil example' }],
  ])('rejects %s even when trusted', (_label, headers) => {
    expect(
      getPublicOrigin({ trustProxyHeaders: true }, { headers }),
    ).toBeNull();
  });

  it('accepts a bracketed IPv6 host when trusted', () => {
    expect(
      getPublicOrigin(
        { trustProxyHeaders: true },
        { headers: { host: '[::1]:1934' }, protocol: 'http' },
      ),
    ).toBe('http://[::1]:1934');
  });
});

describe('isSecureOrigin', () => {
  it('follows the publicUrl scheme', () => {
    expect(
      isSecureOrigin(
        { publicUrl: 'https://a.example', trustProxyHeaders: false },
        { headers: {} },
      ),
    ).toBe(true);
    expect(
      isSecureOrigin(
        { publicUrl: 'http://a.example', trustProxyHeaders: false },
        forged,
      ),
    ).toBe(false);
  });

  it('is not secure without publicUrl, whatever the headers claim', () => {
    expect(isSecureOrigin({ trustProxyHeaders: false }, forged)).toBe(false);
  });

  it('follows the forwarded scheme when headers are trusted', () => {
    expect(isSecureOrigin({ trustProxyHeaders: true }, forged)).toBe(true);
  });
});
