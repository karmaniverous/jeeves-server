import { describe, expect, it } from 'vitest';

import { renderVerifyPage } from './verifyPage.js';

describe('renderVerifyPage', () => {
  it('renders valid HTML with title, heading, and OTP input', () => {
    const html = renderVerifyPage();
    expect(html).toContain('<title>');
    expect(html).toContain('Check your email');
    expect(html).toContain('id="otpInput"');
  });

  it('renders default branding when no branding is provided', () => {
    const html = renderVerifyPage();
    expect(html).toContain('🎩');
    expect(html).toContain('Jeeves Server');
  });

  it('renders custom branding name and emoji in the page', () => {
    const html = renderVerifyPage({ name: 'My Docs', emoji: '📚' });
    expect(html).toContain('📚');
    expect(html).toContain('My Docs');
  });

  it('applies text-transform: lowercase on the OTP input field', () => {
    const html = renderVerifyPage();
    expect(html).toContain('text-transform: lowercase');
  });

  it('includes error message element initially hidden', () => {
    const html = renderVerifyPage();
    expect(html).toContain('id="otpError"');
    expect(html).toContain('style="display:none;"');
  });

  it('navigates to magic callback on successful decryption', () => {
    const html = renderVerifyPage();
    expect(html).toContain('/auth/magic/callback?token=');
  });

  it('shows user-facing error message on decryption failure', () => {
    const html = renderVerifyPage();
    expect(html).toContain('Incorrect code');
  });

  it('does not include sign-in specific elements', () => {
    const html = renderVerifyPage();
    expect(html).not.toContain('id="emailInput"');
    expect(html).not.toContain('Sign in with Google');
  });
});
