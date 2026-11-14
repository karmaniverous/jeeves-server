/**
 * #304: the page a refused Google sign-in gets.
 *
 * @packageDocumentation
 */

import { describe, expect, it } from 'vitest';

import {
  GOOGLE_ACCOUNT_URL,
  renderContactHtml,
  renderSignInRejectedPage,
  type SignInRejectedPageOptions,
} from './signInRejectedPage.js';

const render = (overrides: Partial<SignInRejectedPageOptions> = {}): string =>
  renderSignInRejectedPage({
    email: 'bob@example.com',
    reason: 'not_insider',
    returnTo: '/browse/j/a.md',
    authModes: ['google'],
    branding: { name: 'Acme Docs', emoji: 'A' },
    ...overrides,
  });

describe('renderSignInRejectedPage', () => {
  it('names the account and says it is not on the access list', () => {
    const html = render();
    expect(html).toContain(
      'You signed in with Google as <strong>bob@example.com</strong>.',
    );
    expect(html).toContain("isn't on the access list for Acme Docs");
    expect(html).not.toContain(GOOGLE_ACCOUNT_URL);
    expect(html).toContain('data-render-state="auth-required"');
    expect(html).toContain('<title>A Acme Docs');
  });

  it('says an unverified email is unverified and points at Google', () => {
    const html = render({ reason: 'unverified' });
    expect(html).toContain('<strong>bob@example.com</strong>');
    expect(html).toContain("email address isn't verified");
    expect(html).toContain(`href="${GOOGLE_ACCOUNT_URL}"`);
    expect(html).not.toContain('access list');
  });

  it('links a different-account sign-in with the same returnTo', () => {
    expect(render()).toContain(
      'href="/auth/login?returnTo=%2Fbrowse%2Fj%2Fa.md&amp;prompt=select_account"',
    );
  });

  it('offers the email link only when email sign-in is enabled', () => {
    expect(render()).not.toContain('magicForm');
    const html = render({
      authModes: ['google', 'email'],
      returnTo: '/browse/j/a.md#frag',
    });
    expect(html).toContain('href="/browse/j/a.md#magicForm"');
    expect(html).toContain('Sign in with an email link instead');
  });

  it('never offers key entry', () => {
    expect(render({ authModes: ['google', 'keys'] })).not.toMatch(/\bkey\b/i);
  });

  it('falls back to the administrator without a contact', () => {
    expect(render()).toContain(
      'Ask the administrator of Acme Docs for access.',
    );
    expect(render({ branding: undefined })).toContain(
      'Ask the administrator of Jeeves Server for access.',
    );
  });

  it('shows a configured contact with its email as a mailto link', () => {
    const html = render({ accessContact: 'Jane Doe (jane@example.com)' });
    expect(html).toContain(
      'To get access, ask Jane Doe (<a href="mailto:jane@example.com">jane@example.com</a>).',
    );
    expect(html).not.toContain('administrator');
  });

  it('escapes the email, the contact and the brand', () => {
    const html = render({
      email: '<b>x</b>@example.com',
      accessContact: '<script>alert(1)</script>',
      branding: { name: '<i>Brand</i>', emoji: 'A' },
    });
    expect(html).not.toContain('<b>x</b>');
    expect(html).not.toContain('<script>alert(1)');
    expect(html).not.toContain('<i>Brand</i>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('escapes a hostile returnTo in both links', () => {
    const html = render({
      authModes: ['google', 'email'],
      returnTo: '/x"><script>',
    });
    expect(html).not.toContain('"><script>');
  });
});

describe('renderContactHtml', () => {
  it.each([
    ['Ops team', 'Ops team'],
    ['ops@example.com', '<a href="mailto:ops@example.com">ops@example.com</a>'],
    [
      'Jane <jane@example.com> or ops@example.org',
      'Jane &lt;<a href="mailto:jane@example.com">jane@example.com</a>&gt; or <a href="mailto:ops@example.org">ops@example.org</a>',
    ],
    ['a & b', 'a &amp; b'],
  ])('%j', (contact, html) => {
    expect(renderContactHtml(contact)).toBe(html);
  });
});
