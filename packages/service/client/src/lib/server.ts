/**
 * The SPA's one API client, created at startup from the page URL: `client`
 * (failures returned to the caller) and `server` (the same client, sending
 * the browser to sign-in when a call finds no valid credential). Also the
 * page's share credential, read once.
 */

import { createAppClient, withSignInRedirect } from './appClient';
import { pageShareCredential } from './pageAuth';

/** The page's share credential, read once from the URL it was opened with. */
export const pageCredential = pageShareCredential(window.location.search);

/** The SDK client on the page's origin with the page's credential. */
export const client = createAppClient({
  origin: window.location.origin,
  share: pageCredential,
});

/** Send the browser to sign-in, returning to the current page. */
function signIn(): void {
  window.location.href = `/auth/login?returnTo=${encodeURIComponent(window.location.pathname)}`;
}

/** {@link client}, sending the browser to sign-in on `SERVER_UNAUTHORIZED`. */
export const server = withSignInRedirect(client, signIn);
