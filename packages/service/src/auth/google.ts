/**
 * Google OAuth 2.0 helpers.
 * Uses native fetch — no googleapis SDK needed.
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

interface GoogleUserInfo {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
}

/**
 * Build the Google OAuth consent URL.
 */
export function buildAuthUrl(
  clientId: string,
  redirectUri: string,
  state?: string,
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'consent',
  });
  if (state) params.set('state', state);
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens.
 */
export async function exchangeCode(
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
 * Fetch user info using an access token.
 */
export async function getUserInfo(
  accessToken: string,
): Promise<GoogleUserInfo> {
  const resp = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Google userinfo failed: ${String(resp.status)} ${text}`);
  }

  return (await resp.json()) as GoogleUserInfo;
}
