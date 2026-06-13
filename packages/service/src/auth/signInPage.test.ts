import { describe, expect, it } from 'vitest';

import { renderSignInPage } from './signInPage.js';

describe('renderSignInPage', () => {
  it('renders valid HTML with title, heading, path context, and dark mode support', () => {
    const html = renderSignInPage('/browse/j/docs/readme.md', ['google']);
    expect(html).toContain('<title>Jeeves Server');
    expect(html).toContain('Sign in to continue');
    expect(html).toContain('/browse/j/docs/readme.md');
    expect(html).toContain('prefers-color-scheme: dark');
  });

  it('renders Google sign-in link with encoded returnTo when google mode is active', () => {
    const html = renderSignInPage('/browse/j/docs/readme.md?foo=bar', [
      'google',
    ]);
    expect(html).toContain('/auth/login?returnTo=');
    expect(html).toContain('Sign in with Google');
    expect(html).toContain(
      encodeURIComponent('/browse/j/docs/readme.md?foo=bar'),
    );
  });

  it('shows key-required message without Google link when google mode is absent', () => {
    const html = renderSignInPage('/browse/j/docs/readme.md', ['keys']);
    expect(html).toContain('API key for access');
    expect(html).not.toContain('Sign in with Google');
  });

  it('escapes HTML entities in the URL to prevent XSS', () => {
    const html = renderSignInPage('/browse/<script>alert(1)</script>', [
      'google',
    ]);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
