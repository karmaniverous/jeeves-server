/**
 * Google sign-in to the portal (`auth.modes` includes `google`): the consent URL, the code exchange and the signed-in account. Distinct from the generic OAuth2 provider flow on `/oauth/callback` (#270). Uses native fetch, no googleapis SDK.
 *
 * @packageDocumentation
 */

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';

interface GoogleTokens {
  access_token: string;
  id_token?: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

/** The Google account a sign-in returned. */
export interface GoogleSignInUser {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
}

/**
 * Google's `prompt`: `consent` for a normal sign-in, `select_account` to
 * let the person pick a different Google account (#304).
 */
export type GoogleSignInPrompt = 'consent' | 'select_account';

/**
 * Build the Google sign-in consent URL.
 *
 * @param clientId - The Google client ID.
 * @param redirectUri - The redirect URI (`{public origin}/auth/callback`).
 * @param state - Opaque state (the encoded `returnTo`).
 * @param prompt - Google's `prompt`.
 * @returns The URL.
 */
export function buildGoogleSignInUrl(
  clientId: string,
  redirectUri: string,
  state?: string,
  prompt: GoogleSignInPrompt = 'consent',
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt,
  });
  if (state) params.set('state', state);
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange a Google sign-in authorization code for tokens.
 */
export async function exchangeGoogleSignInCode(
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  code: string,
): Promise<GoogleTokens> {
  const resp = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code,
      grant_type: 'authorization_code',
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(
      `Google token exchange failed: ${String(resp.status)} ${text}`,
    );
  }

  return (await resp.json()) as GoogleTokens;
}

/**
 * Fetch the signed-in Google account with an access token.
 */
export async function getGoogleSignInUser(
  accessToken: string,
): Promise<GoogleSignInUser> {
  const resp = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Google userinfo failed: ${String(resp.status)} ${text}`);
  }

  return (await resp.json()) as GoogleSignInUser;
}
