/**
 * The sign-in redirect URIs (#270): Google's only with the `google` mode, the OAuth one only with providers, neither without a public origin, and request headers only when they are trusted.
 *
 * @packageDocumentation
 */

import { describe, expect, it } from 'vitest';

import { googleSignInRedirectUri, statusRedirectUris } from './redirectUris.js';

const PROVIDER = {
  authUrl: 'https://a.test',
  tokenUrl: 'https://t.test',
  pkce: false,
  defaultScopes: [],
};

const config = (overrides: Record<string, unknown> = {}) => ({
  publicUrl: 'https://docs.example.com/',
  trustProxyHeaders: false,
  authModes: ['google', 'keys'] as ('google' | 'keys' | 'email')[],
  oauth: { credentialDir: '/c', providers: { acme: PROVIDER } },
  ...overrides,
});

const request = { headers: { host: 'evil.test' } };

describe('statusRedirectUris', () => {
  it('reports both on the public origin', () => {
    expect(statusRedirectUris(config(), request)).toEqual({
      googleRedirectUri: 'https://docs.example.com/auth/callback',
      oauthRedirectUri: 'https://docs.example.com/oauth/callback',
    });
  });

  it('omits Google without the google mode', () => {
    expect(
      statusRedirectUris(config({ authModes: ['keys'] }), request),
    ).toEqual({ oauthRedirectUri: 'https://docs.example.com/oauth/callback' });
  });

  it.each([
    ['no oauth block', null],
    ['no providers', { credentialDir: '/c', providers: {} }],
  ])('omits OAuth with %s', (_label, oauth) => {
    expect(statusRedirectUris(config({ oauth }), request)).toEqual({
      googleRedirectUri: 'https://docs.example.com/auth/callback',
    });
  });

  it('reports nothing without a public origin (untrusted headers)', () => {
    expect(statusRedirectUris(config({ publicUrl: null }), request)).toEqual(
      {},
    );
  });

  it('uses trusted proxy headers when there is no publicUrl', () => {
    expect(
      statusRedirectUris(config({ publicUrl: null, trustProxyHeaders: true }), {
        headers: { 'x-forwarded-proto': 'https', host: 'proxy.test' },
      }),
    ).toEqual({
      googleRedirectUri: 'https://proxy.test/auth/callback',
      oauthRedirectUri: 'https://proxy.test/oauth/callback',
    });
  });
});

describe('googleSignInRedirectUri', () => {
  it('is the callback on the public origin, or null', () => {
    expect(googleSignInRedirectUri(config(), request)).toBe(
      'https://docs.example.com/auth/callback',
    );
    expect(
      googleSignInRedirectUri(config({ publicUrl: null }), request),
    ).toBeNull();
  });
});
