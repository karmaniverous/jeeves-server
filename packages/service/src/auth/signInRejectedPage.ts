/**
 * The page a refused Google sign-in gets (#304), in the sign-in page's shell and branding: which Google account was used and why it was refused, a link to sign in with a different Google account, the other ways in this server enables, and who to ask for access. Pure.
 *
 * @packageDocumentation
 */

import type { AuthMode } from '../config/types.js';
import { RENDER_STATE } from '../util/renderState.js';
import { escapeHtml, renderPageShell } from './pageShell.js';

/** Why a Google sign-in was refused. */
export type SignInRejectionReason = 'not_insider' | 'unverified';

/** What the rejection page shows. */
export interface SignInRejectedPageOptions {
  /** The email Google signed the person in with. */
  email: string;
  /** Why the sign-in was refused. */
  reason: SignInRejectionReason;
  /** The validated `returnTo` the sign-in was for. */
  returnTo: string;
  /** Configured sign-in modes. */
  authModes: AuthMode[];
  /** Server branding. */
  branding?: { name: string; emoji: string };
  /** `auth.accessContact`, free text. */
  accessContact?: string;
}

/** Google's account settings, for an unverified email. */
export const GOOGLE_ACCOUNT_URL = 'https://myaccount.google.com/';

const REJECTED_CSS = `  .reason { font-size: 0.95rem; line-height: 1.5; margin-bottom: 1.25rem; }
  .reason strong { overflow-wrap: anywhere; }
  .muted { font-size: 0.9rem; color: #666; line-height: 1.5; margin-top: 1rem; }
  .muted a, .reason a { color: #4285f4; }
  .alt { margin-top: 0.75rem; font-size: 0.95rem; }
  .alt a { color: #4285f4; }
  .dark .muted { color: #999; }`;

/** An email address inside free text. */
const EMAIL_RE = /[^\s<>()"',;:]+@[^\s<>()"',;:]+\.[^\s<>()"',;:]+/gu;

/**
 * Free-text contact as HTML: escaped, with each email address in it a
 * `mailto:` link.
 *
 * @param contact - The contact text.
 * @returns The HTML.
 */
export function renderContactHtml(contact: string): string {
  let html = '';
  let last = 0;
  for (const match of contact.matchAll(EMAIL_RE)) {
    const address = match[0];
    html += escapeHtml(contact.slice(last, match.index));
    html += `<a href="mailto:${escapeHtml(address)}">${escapeHtml(address)}</a>`;
    last = match.index + address.length;
  }
  return html + escapeHtml(contact.slice(last));
}

/**
 * The reason, in plain words.
 *
 * @param email - The email (escaped here).
 * @param reason - Why the sign-in was refused.
 * @param brandName - The server's name.
 * @returns The HTML.
 */
function reasonHtml(
  email: string,
  reason: SignInRejectionReason,
  brandName: string,
): string {
  const who = `You signed in with Google as <strong>${escapeHtml(email)}</strong>.`;
  return reason === 'unverified'
    ? `${who} That Google account's email address isn't verified, so ${escapeHtml(brandName)} can't accept it. Verify it in your <a href="${GOOGLE_ACCOUNT_URL}">Google account settings</a> and try again.`
    : `${who} That account isn't on the access list for ${escapeHtml(brandName)}.`;
}

/**
 * Render the rejection page.
 *
 * @param options - What to show.
 * @returns Complete HTML page string.
 */
export function renderSignInRejectedPage(
  options: SignInRejectedPageOptions,
): string {
  const brandName = options.branding?.name ?? 'Jeeves Server';
  const switchHref = `/auth/login?returnTo=${encodeURIComponent(options.returnTo)}&prompt=select_account`;
  const returnPath = options.returnTo.split('#')[0] ?? options.returnTo;
  const emailAlt = options.authModes.includes('email')
    ? `<div class="alt"><a href="${escapeHtml(`${returnPath}#magicForm`)}">Sign in with an email link instead</a></div>`
    : '';
  const contact = options.accessContact
    ? `To get access, ask ${renderContactHtml(options.accessContact)}.`
    : `Ask the administrator of ${escapeHtml(brandName)} for access.`;

  const bodyContent = `<h2>Sign-in not allowed</h2>
<p class="reason">${reasonHtml(options.email, options.reason, brandName)}</p>
<a href="${escapeHtml(switchHref)}" class="btn-primary">Sign in with a different Google account</a>
${emailAlt}
<p class="muted">${contact}</p>`;

  return renderPageShell({
    titleSuffix: 'Sign-in not allowed',
    brandName: options.branding?.name,
    brandEmoji: options.branding?.emoji,
    extraCss: REJECTED_CSS,
    bodyContent,
    renderState: RENDER_STATE.authRequired,
  });
}
