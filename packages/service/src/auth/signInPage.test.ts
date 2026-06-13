import { describe, expect, it } from 'vitest';

import { renderSignInPage } from './signInPage.js';

describe('renderSignInPage', () => {
  it('includes the page title', () => {
    const html = renderSignInPage('/browse/j/docs/readme.md', ['google']);
    expect(html).toContain('<title>Jeeves Server');
  });

  it('includes the sign-in heading', () => {
    const html = renderSignInPage('/browse/j/docs/readme.md', ['google']);
    expect(html).toContain('Sign in to continue');
  });

  it('shows the requested path', () => {
    const html = renderSignInPage('/browse/j/docs/readme.md', ['google']);
    expect(html).toContain('/browse/j/docs/readme.md');
  });

  it('renders a Google sign-in link when google mode is active', () => {
    const html = renderSignInPage('/browse/j/docs/readme.md', ['google']);
    expect(html).toContain('/auth/login?returnTo=');
    expect(html).toContain('Sign in with Google');
  });

  it('encodes the returnTo URL', () => {
    const html = renderSignInPage('/browse/j/docs/readme.md?foo=bar', [
      'google',
    ]);
    expect(html).toContain(
      encodeURIComponent('/browse/j/docs/readme.md?foo=bar'),
    );
  });

  it('shows key-required message when google mode is absent', () => {
    const html = renderSignInPage('/browse/j/docs/readme.md', ['keys']);
    expect(html).toContain('API key for access');
    expect(html).not.toContain('Sign in with Google');
  });

  it('includes dark mode media query', () => {
    const html = renderSignInPage('/browse/j/docs/readme.md', ['google']);
    expect(html).toContain('prefers-color-scheme: dark');
  });

  it('escapes HTML entities in the URL', () => {
    const html = renderSignInPage('/browse/<script>alert(1)</script>', [
      'google',
    ]);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
