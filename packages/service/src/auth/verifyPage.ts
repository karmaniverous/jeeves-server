/**
 * Server-rendered OTP verification page.
 *
 * Shown after the user submits their email on the sign-in page. Uses inline
 * JavaScript with the Web Crypto API to derive an AES-256-GCM key from the
 * OTP (via SHA-256), decrypt the encrypted token blob, and redirect to the
 * magic link callback.
 *
 * Uses the shared page shell from `pageShell.ts` for consistent branding,
 * theme support, and dark-mode behavior.
 *
 * @packageDocumentation
 */

import { renderPageShell } from './pageShell.js';

/** Page-specific CSS for the OTP input field. */
const VERIFY_CSS = `  .instructions {
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
  .dark .instructions { color: #999; }
  .dark .otp-input { background: #2a2a2a; color: #e0e0e0; border-color: #444; }
  .dark .otp-input:focus { border-color: #4285f4; }`;

/** Inline JS for OTP decryption and redirect via Web Crypto API. */
const VERIFY_SCRIPT = `async function verifyOtp() {
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
    errorEl.textContent = 'Incorrect code \\u2014 please try again';
    errorEl.style.display = 'block';
  }
}`;

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
  const bodyContent = `<h2>Check your email</h2>
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
</form>`;

  return renderPageShell({
    titleSuffix: 'Verify Code',
    brandName: branding?.name,
    brandEmoji: branding?.emoji,
    extraCss: VERIFY_CSS,
    bodyContent,
    footerScript: VERIFY_SCRIPT,
  });
}
