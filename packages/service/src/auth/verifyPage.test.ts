import { describe, expect, it } from 'vitest';

import { renderVerifyPage } from './verifyPage.js';

describe('renderVerifyPage', () => {
  it('renders valid HTML with title, heading, and OTP input', () => {
    const html = renderVerifyPage();
    expect(html).toContain('<title>');
    expect(html).toContain('Check your email');
    expect(html).toContain('id="otpInput"');
    expect(html).toContain('.dark body');
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

  it('has text-transform: lowercase on the OTP input field', () => {
    const html = renderVerifyPage();
    expect(html).toContain('text-transform: lowercase');
  });

  it('includes error message element initially hidden', () => {
    const html = renderVerifyPage();
    expect(html).toContain('id="otpError"');
    expect(html).toContain('style="display:none;"');
  });

  it('uses Web Crypto API SHA-256 key derivation', () => {
    const html = renderVerifyPage();
    expect(html).toContain('crypto.subtle.digest');
    expect(html).toContain('SHA-256');
  });

  it('uses AES-GCM decryption', () => {
    const html = renderVerifyPage();
    expect(html).toContain('AES-GCM');
    expect(html).toContain('crypto.subtle.decrypt');
  });

  it('navigates to magic callback with decrypted token on success', () => {
    const html = renderVerifyPage();
    expect(html).toContain('/auth/magic/callback?token=');
    expect(html).toContain('window.location.href');
  });

  it('shows incorrect code message on decryption failure', () => {
    const html = renderVerifyPage();
    expect(html).toContain('Incorrect code');
    expect(html).toContain('please try again');
  });

  it('normalizes OTP to lowercase on submit', () => {
    const html = renderVerifyPage();
    expect(html).toContain('.toLowerCase()');
  });

  it('uses dark mode class toggling matching SPA behavior', () => {
    const html = renderVerifyPage();
    expect(html).toContain("localStorage.getItem('jeeves-theme')");
    expect(html).toContain("classList.add('dark')");
  });

  it('includes base64url decoding logic for the enc parameter', () => {
    const html = renderVerifyPage();
    expect(html).toContain("params.get('enc')");
    expect(html).toContain('atob(');
  });

  it('does not include sign-in specific elements like emailInput or Google button', () => {
    const html = renderVerifyPage();
    expect(html).not.toContain('id="emailInput"');
    expect(html).not.toContain('Sign in with Google');
  });
});
