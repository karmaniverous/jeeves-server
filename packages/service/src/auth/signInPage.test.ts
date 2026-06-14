import { describe, expect, it } from 'vitest';

import { renderSignInPage } from './signInPage.js';

describe('renderSignInPage', () => {
  it('renders valid HTML with title, heading, path context, and dark mode support', () => {
    const html = renderSignInPage('/browse/j/docs/readme.md', ['google']);
    expect(html).toContain('<title>');
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

  it('shows key-required message without Google link when only keys mode is present', () => {
    const html = renderSignInPage('/browse/j/docs/readme.md', ['keys']);
    expect(html).toContain('API key for access');
    expect(html).not.toContain('Sign in with Google');
    expect(html).not.toContain('id="emailInput"');
  });

  it('escapes HTML entities in the URL to prevent XSS', () => {
    const html = renderSignInPage('/browse/<script>alert(1)</script>', [
      'google',
    ]);
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;script&gt;');
  });

  it('shows email form and no Google button when authModes is email-only', () => {
    const html = renderSignInPage('/browse/j/docs', ['email']);
    expect(html).toContain('id="emailInput"');
    expect(html).toContain('Send Login Link');
    expect(html).not.toContain('Sign in with Google');
    expect(html).not.toContain('— or —');
  });

  it('shows Google button and no email form when authModes is google-only', () => {
    const html = renderSignInPage('/browse/j/docs', ['google']);
    expect(html).toContain('Sign in with Google');
    expect(html).not.toContain('id="emailInput"');
    expect(html).not.toContain('Send Login Link');
    expect(html).not.toContain('— or —');
  });

  it('shows both email form and Google button with divider when both modes are active', () => {
    const html = renderSignInPage('/browse/j/docs', ['email', 'google']);
    expect(html).toContain('emailInput');
    expect(html).toContain('Send Login Link');
    expect(html).toContain('Sign in with Google');
    expect(html).toContain('— or —');
  });

  it('renders custom branding name and emoji in the page', () => {
    const html = renderSignInPage('/browse/j/docs', ['google'], {
      name: 'My Docs',
      emoji: '📚',
    });
    expect(html).toContain('📚');
    expect(html).toContain('My Docs');
  });

  it('renders default branding when no branding is provided', () => {
    const html = renderSignInPage('/browse/j/docs', ['google']);
    expect(html).toContain('🎩');
    expect(html).toContain('Jeeves Server');
  });

  it('includes hidden confirmation message element in the page', () => {
    const html = renderSignInPage('/browse/j/docs', ['email']);
    expect(html).toContain('id="emailConfirmation"');
    expect(html).toContain('style="display:none;"');
    expect(html).toContain('Check your email for a login link');
  });

  it('confirmation message is present even when Google mode is also active', () => {
    const html = renderSignInPage('/browse/j/docs', ['email', 'google']);
    expect(html).toContain('id="emailConfirmation"');
    expect(html).toContain('Sign in with Google');
  });
});
