/**
 * Server-rendered OTP verification page.
 *
 * Shown after the user submits their email on the sign-in page. Uses inline
 * JavaScript with the Web Crypto API to derive an AES-256-GCM key from the
 * OTP (via SHA-256), decrypt the encrypted token blob, and redirect to the
 * magic link callback.
 *
 * Same minimal-HTML and branding pattern as `signInPage.ts`.
 *
 * @packageDocumentation
 */

/**
 * Render an OTP verification page HTML string.
 *
 * @param branding - Optional branding configuration (name and emoji).
 * @returns Complete HTML page string.
 */
export function renderVerifyPage(branding?: {
  name: string;
  emoji: string;
}): string {
  const brandName = branding?.name ?? 'Jeeves Server';
  const brandEmoji = branding?.emoji ?? '🎩';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(brandEmoji)} ${escapeHtml(brandName)} — Verify Code</title>
<script>
// Theme: match SPA behavior — read localStorage, fall back to system preference.
(function() {
  var saved = localStorage.getItem('jeeves-theme');
  var theme = saved === 'dark' || saved === 'light' ? saved
    : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  if (theme === 'dark') document.documentElement.classList.add('dark');
})();
</script>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: system-ui, -apple-system, sans-serif;
    color: #1a1a1a;
    background: #fff;
  }
  /* Header — matches SPA zinc-800 bar */
  .header {
    background: #27272a;
    color: #fff;
    padding: 0.5rem 1rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .header-brand {
    font-size: 1.5rem;
    text-decoration: none;
    color: #fff;
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }
  .header-brand-name {
    font-size: 0.875rem;
    font-weight: 500;
    color: #d4d4d8;
  }
  .theme-btn {
    background: transparent;
    border: none;
    color: #d4d4d8;
    cursor: pointer;
    padding: 0.375rem;
    border-radius: 0.25rem;
    display: flex;
    align-items: center;
    transition: color 0.15s, background 0.15s;
  }
  .theme-btn:hover { color: #fff; background: rgba(255,255,255,0.1); }
  .theme-btn svg { width: 1rem; height: 1rem; }
  /* Moon icon hidden in dark mode, sun icon hidden in light mode */
  .icon-sun { display: none; }
  .icon-moon { display: block; }
  .dark .icon-sun { display: block; }
  .dark .icon-moon { display: none; }
  /* Content */
  .content {
    margin: 60px auto;
    padding: 0 20px;
    text-align: center;
  }
  .box {
    max-width: 400px;
    margin: 0 auto;
  }
  h1 { font-size: 1.5rem; font-weight: 600; margin-bottom: 0.25rem; }
  h2 { font-size: 1rem; font-weight: 400; color: #666; margin-top: 0; margin-bottom: 1rem; }
  .instructions {
    font-size: 0.875rem;
    color: #666;
    line-height: 1.5;
    margin-bottom: 1.25rem;
  }
  .otp-input {
    display: block;
    width: 100%;
    padding: 10px 12px;
    font-size: 1.1rem;
    letter-spacing: 0.1em;
    text-align: center;
    text-transform: lowercase;
    border: 1px solid #ccc;
    border-radius: 4px;
    margin-bottom: 0.75rem;
    background: #fff;
    color: #1a1a1a;
    outline: none;
    transition: border-color 0.15s;
  }
  .otp-input:focus { border-color: #4285f4; }
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
  .error-msg {
    margin-top: 0.5rem;
    font-size: 0.875rem;
    color: #d93025;
  }
  /* Dark mode overrides (class-based, matches SPA) */
  .dark body { color: #e0e0e0; background: #1a1a1a; }
  .dark h2 { color: #999; }
  .dark .instructions { color: #999; }
  .dark .otp-input { background: #2a2a2a; color: #e0e0e0; border-color: #444; }
  .dark .otp-input:focus { border-color: #4285f4; }
</style>
</head>
<body>
<header class="header">
  <span class="header-brand">${escapeHtml(brandEmoji)} <span class="header-brand-name">${escapeHtml(brandName)}</span></span>
  <button class="theme-btn" id="themeToggle" title="Toggle theme">
    <svg class="icon-sun" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
    <svg class="icon-moon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
  </button>
</header>
<div class="content">
<div class="box">
<h1>${escapeHtml(brandEmoji)} ${escapeHtml(brandName)}</h1>
<h2>Check your email</h2>
<p class="instructions">Enter the 8-character code from your email below, or click the magic link in the email directly.</p>
<form id="otpForm" onsubmit="verifyOtp(); return false;">
  <input
    type="text"
    id="otpInput"
    placeholder="e.g. a3k7 m9p2"
    class="otp-input"
    autocomplete="one-time-code"
    inputmode="text"
    maxlength="9"
    autofocus
  >
  <button type="submit" class="btn-primary">Verify Code</button>
  <div class="error-msg" id="otpError" style="display:none;"></div>
</form>
</div>
</div>
<script>
document.getElementById('themeToggle').addEventListener('click', function() {
  var html = document.documentElement;
  var isDark = html.classList.toggle('dark');
  localStorage.setItem('jeeves-theme', isDark ? 'dark' : 'light');
});

async function verifyOtp() {
  var raw = document.getElementById('otpInput').value;
  var otp = raw.replace(/\\s+/g, '').toLowerCase();
  var errorEl = document.getElementById('otpError');
  errorEl.style.display = 'none';
  errorEl.textContent = '';

  try {
    var params = new URLSearchParams(window.location.search);
    var enc = params.get('enc');
    if (!enc) { throw new Error('missing enc'); }

    // base64url decode: replace URL-safe chars, restore padding
    var b64 = enc.replace(/-/g, '+').replace(/_/g, '/');
    var pad = (4 - b64.length % 4) % 4;
    b64 += '==='.slice(0, pad);
    var bytes = Uint8Array.from(atob(b64), function(c) { return c.charCodeAt(0); });

    // Combined format: iv (12 bytes) | ciphertext | authTag (16 bytes)
    // WebCrypto AES-GCM decrypt expects: ciphertext | authTag
    var iv = bytes.slice(0, 12);
    var data = bytes.slice(12); // ciphertext + authTag — exactly what WebCrypto needs

    // Derive AES-256-GCM key: SHA-256(otp)
    var otpBytes = new TextEncoder().encode(otp);
    var keyData = await crypto.subtle.digest('SHA-256', otpBytes);
    var key = await crypto.subtle.importKey('raw', keyData, { name: 'AES-GCM' }, false, ['decrypt']);

    // Decrypt
    var decryptedBuf = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv, tagLength: 128 },
      key,
      data
    );
    var token = new TextDecoder().decode(decryptedBuf);
    window.location.href = '/auth/magic/callback?token=' + encodeURIComponent(token);
  } catch (_) {
    errorEl.textContent = 'Incorrect code \u2014 please try again';
    errorEl.style.display = 'block';
  }
}
</script>
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
