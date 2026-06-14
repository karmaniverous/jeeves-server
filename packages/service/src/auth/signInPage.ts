/**
 * Server-rendered sign-in page for unauthenticated SPA requests.
 *
 * Uses the same minimal inline HTML pattern as the OAuth callback pages.
 * No SPA dependencies, no CSS framework.
 *
 * @packageDocumentation
 */

import type { AuthMode } from '../config/types.js';

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

  const brandName = branding?.name ?? 'Jeeves Server';
  const brandEmoji = branding?.emoji ?? '🎩';

  const emailFormHtml = hasEmail
    ? `<div class="email-form" id="emailForm">
  <form id="magicForm" onsubmit="return false;">
    <input
      type="email"
      id="emailInput"
      placeholder="Enter your email"
      required
      class="email-input"
    >
    <button type="submit" class="btn-primary" onclick="submitMagic()">Send Login Link</button>
    <div class="error-msg" id="emailError" style="display:none;"></div>
  </form>
</div>
<div class="confirmation" id="emailConfirmation" style="display:none;">
  <p class="muted">Check your email for a login link — if you&apos;re registered, one is on its way.</p>
</div>
<script>
function submitMagic() {
  var email = document.getElementById('emailInput').value;
  var errorEl = document.getElementById('emailError');
  errorEl.style.display = 'none';
  errorEl.textContent = '';
  fetch('/api/auth/magic', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email })
  })
  .then(function(res) {
    if (res.ok) {
      document.getElementById('emailForm').style.display = 'none';
      document.getElementById('emailConfirmation').style.display = 'block';
    } else {
      errorEl.textContent = 'Something went wrong. Please try again.';
      errorEl.style.display = 'block';
    }
  })
  .catch(function() {
    errorEl.textContent = 'Network error. Please try again.';
    errorEl.style.display = 'block';
  });
}
</script>`
    : '';

  const dividerHtml =
    hasEmail && hasGoogle
      ? `<div class="divider"><span>— or —</span></div>`
      : '';

  const googleButtonHtml = hasGoogle
    ? `<a href="${escapeHtml(loginHref)}" class="btn-secondary">Sign in with Google</a>`
    : '';

  const noAuthHtml =
    !hasGoogle && !hasEmail
      ? `<p class="muted">This server requires an API key for access.</p>`
      : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(brandEmoji)} ${escapeHtml(brandName)} — Sign In</title>
<style>
  body {
    font-family: system-ui, -apple-system, sans-serif;
    margin: 80px auto;
    padding: 0 20px;
    text-align: center;
    color: #1a1a1a;
    background: #fff;
  }
  .box {
    max-width: 400px;
    margin: 0 auto;
  }
  @media (prefers-color-scheme: dark) {
    body { color: #e0e0e0; background: #1a1a1a; }
    code { background: #2a2a2a; }
    .email-input { background: #2a2a2a; color: #e0e0e0; border-color: #444; }
    .email-input:focus { border-color: #4285f4; }
    .btn-secondary {
      background: transparent;
      color: #e0e0e0;
      border-color: #555;
    }
    .btn-secondary:hover { border-color: #e0e0e0; }
    .muted { color: #999; }
    .divider { color: #555; }
  }
  h1 { font-size: 1.5rem; font-weight: 600; margin-bottom: 0.25rem; }
  h2 { font-size: 1rem; font-weight: 400; color: #666; margin-top: 0; margin-bottom: 1.25rem; }
  @media (prefers-color-scheme: dark) { h2 { color: #999; } }
  code {
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
  @media (prefers-color-scheme: dark) { .url-block { color: #999; } }
  .email-input {
    display: block;
    width: 100%;
    box-sizing: border-box;
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
  .btn-primary {
    display: block;
    width: 100%;
    padding: 10px 24px;
    background: #4285f4;
    color: #fff;
    border: none;
    border-radius: 4px;
    font-size: 0.95rem;
    font-weight: 500;
    cursor: pointer;
    text-align: center;
    transition: background 0.15s;
  }
  .btn-primary:hover { background: #3367d6; }
  .btn-secondary {
    display: block;
    padding: 10px 24px;
    background: transparent;
    color: #1a1a1a;
    text-decoration: none;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 0.95rem;
    font-weight: 500;
    transition: border-color 0.15s;
  }
  .btn-secondary:hover { border-color: #1a1a1a; }
  .divider {
    margin: 1rem 0;
    font-size: 0.85rem;
    color: #999;
  }
  .error-msg {
    margin-top: 0.5rem;
    font-size: 0.875rem;
    color: #d93025;
  }
  .muted { font-size: 0.95rem; color: #666; line-height: 1.5; }
  .action { margin-top: 0.25rem; }
</style>
</head>
<body>
<div class="box">
<h1>${escapeHtml(brandEmoji)} ${escapeHtml(brandName)}</h1>
<h2>Sign in to continue</h2>
<div class="url-block">Trying to access:<br><code>${escapedUrl}</code></div>
${emailFormHtml}${dividerHtml}
<div class="action">${googleButtonHtml}${noAuthHtml}</div>
</div>
</body>
</html>`;
}

/** Basic HTML entity escaping for untrusted values. */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
