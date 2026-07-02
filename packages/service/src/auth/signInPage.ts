/**
 * Server-rendered sign-in page for unauthenticated SPA requests.
 *
 * Uses the shared page shell from `pageShell.ts` for consistent branding,
 * theme support, and dark-mode behavior across all server-rendered pages.
 *
 * @packageDocumentation
 */

import type { AuthMode } from '../config/types.js';
import { escapeHtml, renderPageShell } from './pageShell.js';

/** Page-specific CSS (email input, Google button, divider, etc.). */
const SIGN_IN_CSS = `  code {
    display: inline-block;
    max-width: 100%;
    overflow-wrap: break-word;
    word-break: break-all;
    padding: 2px 6px;
    background: #f0f0f0;
    border-radius: 3px;
    font-size: 0.85rem;
  }
  .url-block { margin-bottom: 1.5rem; font-size: 0.9rem; color: #666; }
  .email-input {
    display: block;
    width: 100%;
    padding: 10px 12px;
    font-size: 0.95rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    margin-bottom: 0.75rem;
    background: #fff;
    color: #1a1a1a;
    outline: none;
    transition: border-color 0.15s;
  }
  .email-input:focus { border-color: #4285f4; }
  /* Google-branded button */
  .btn-google {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 10px 24px;
    background: #fff;
    color: #3c4043;
    text-decoration: none;
    border: 1px solid #dadce0;
    border-radius: 4px;
    font-size: 0.95rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s, box-shadow 0.15s;
  }
  .btn-google:hover { background: #f7f8f8; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
  .google-logo { width: 18px; height: 18px; flex-shrink: 0; }
  .divider {
    margin: 1rem 0;
    font-size: 0.85rem;
    color: #999;
  }
  .muted { font-size: 0.95rem; color: #666; line-height: 1.5; }
  .action { margin-top: 0.25rem; }
  .dark code { background: #2a2a2a; }
  .dark .url-block { color: #999; }
  .dark .email-input { background: #2a2a2a; color: #e0e0e0; border-color: #444; }
  .dark .email-input:focus { border-color: #4285f4; }
  .dark .btn-google { background: #fff; color: #3c4043; border-color: #dadce0; }
  .dark .btn-google:hover { background: #f7f8f8; }
  .dark .muted { color: #999; }
  .dark .divider { color: #555; }`;

/** Inline JS for the email magic-link form submission. */
const MAGIC_FORM_SCRIPT = `function submitMagic() {
  var email = document.getElementById('emailInput').value;
  var errorEl = document.getElementById('emailError');
  errorEl.style.display = 'none';
  errorEl.textContent = '';
  fetch('/api/auth/magic', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email, returnTo: window.location.pathname + window.location.search })
  })
  .then(function(res) {
    if (res.ok) { return res.json(); }
    errorEl.textContent = 'Something went wrong. Please try again.';
    errorEl.style.display = 'block';
    return null;
  })
  .then(function(data) {
    if (data && data.verifyUrl) { window.location.href = data.verifyUrl; }
  })
  .catch(function() {
    errorEl.textContent = 'Network error. Please try again.';
    errorEl.style.display = 'block';
  });
}`;

/**
 * Render a branded sign-in page HTML string.
 *
 * @param requestUrl - The URL the user was trying to access.
 * @param authModes - Configured auth modes from the server config.
 * @param branding - Optional branding configuration (name and emoji).
 * @returns Complete HTML page string.
 */
export function renderSignInPage(
  requestUrl: string,
  authModes: AuthMode[],
  branding?: { name: string; emoji: string },
): string {
  const escapedUrl = escapeHtml(requestUrl);
  const hasGoogle = authModes.includes('google');
  const hasEmail = authModes.includes('email');
  const loginHref = `/auth/login?returnTo=${encodeURIComponent(requestUrl)}`;

  const emailFormHtml = hasEmail
    ? `<form id="magicForm" onsubmit="submitMagic(); return false;">
  <input
    type="email"
    id="emailInput"
    placeholder="Enter your email"
    required
    aria-label="Email address"
    class="email-input"
  >
  <button type="submit" class="btn-primary">Send Login Link</button>
  <div class="error-msg" id="emailError" style="display:none;"></div>
</form>`
    : '';

  const dividerHtml =
    hasEmail && hasGoogle
      ? `<div class="divider"><span>— or —</span></div>`
      : '';

  const googleButtonHtml = hasGoogle
    ? `<a href="${escapeHtml(loginHref)}" class="btn-google"><svg class="google-logo" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>Sign in with Google</a>`
    : '';

  const noAuthHtml =
    !hasGoogle && !hasEmail
      ? `<p class="muted">This server requires an API key for access.</p>`
      : '';

  const bodyContent = `<h2>Sign in to continue</h2>
<div class="url-block">Trying to access:<br><code>${escapedUrl}</code></div>
${emailFormHtml}${dividerHtml}
<div class="action">${googleButtonHtml}${noAuthHtml}</div>`;

  return renderPageShell({
    titleSuffix: 'Sign In',
    brandName: branding?.name,
    brandEmoji: branding?.emoji,
    extraCss: SIGN_IN_CSS,
    bodyContent,
    footerScript: hasEmail ? MAGIC_FORM_SCRIPT : undefined,
  });
}
