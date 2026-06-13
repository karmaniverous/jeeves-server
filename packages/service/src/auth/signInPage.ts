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
 * @returns Complete HTML page string.
 */
export function renderSignInPage(
  requestUrl: string,
  authModes: AuthMode[],
): string {
  const escapedUrl = escapeHtml(requestUrl);
  const hasGoogle = authModes.includes('google');
  const loginHref = `/auth/login?returnTo=${encodeURIComponent(requestUrl)}`;

  const actionHtml = hasGoogle
    ? `<a href="${escapeHtml(loginHref)}" style="display:inline-block;padding:10px 24px;background:#4285f4;color:#fff;text-decoration:none;border-radius:4px;font-size:14px;font-weight:500;">Sign in with Google</a>`
    : `<p style="color:#888;">This server requires an API key for access.</p>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Jeeves Server — Sign In</title>
<style>
  body {
    font-family: system-ui, -apple-system, sans-serif;
    max-width: 480px;
    margin: 80px auto;
    padding: 0 20px;
    text-align: center;
    color: #1a1a1a;
    background: #fff;
  }
  @media (prefers-color-scheme: dark) {
    body { color: #e0e0e0; background: #1a1a1a; }
    code { background: #2a2a2a; }
    a[href] { background: #4285f4; }
  }
  h1 { font-size: 1.5rem; font-weight: 600; margin-bottom: 0.5rem; }
  p { font-size: 0.95rem; line-height: 1.5; color: #666; }
  @media (prefers-color-scheme: dark) { p { color: #999; } }
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
  .action { margin-top: 2rem; }
</style>
</head>
<body>
<h1>Sign in to continue</h1>
<p>You're trying to access:<br><code>${escapedUrl}</code></p>
<div class="action">${actionHtml}</div>
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
