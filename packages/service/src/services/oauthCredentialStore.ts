/**
 * OAuth2 credential store: reading, writing and refreshing the per
 * provider/account credential files under `oauth.credentialDir`.
 *
 * @packageDocumentation
 */

import fsp from 'node:fs/promises';

/** Contents of a stored OAuth2 credential file. */
export interface CredentialFile {
  provider: string;
  account: string;
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type: string;
  scope?: string;
  obtained_at: string;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
}

/** True when the credential has an expiry and it has passed. */
export function isExpired(cred: CredentialFile): boolean {
  if (cred.expires_in === undefined) return false;
  const obtainedMs = new Date(cred.obtained_at).getTime();
  return Date.now() > obtainedMs + cred.expires_in * 1000;
}

/**
 * Whole seconds until the credential expires (never negative), or null when
 * it has no expiry.
 */
export function remainingSeconds(cred: CredentialFile): number | null {
  if (cred.expires_in === undefined) return null;
  const obtainedMs = new Date(cred.obtained_at).getTime();
  const remaining = Math.floor(
    (obtainedMs + cred.expires_in * 1000 - Date.now()) / 1000,
  );
  return Math.max(0, remaining);
}

/** True when a credential file exists at `filePath`. */
export async function credentialExists(filePath: string): Promise<boolean> {
  try {
    await fsp.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/** Read and parse a credential file. Throws when unreadable or not JSON. */
export async function readCredential(
  filePath: string,
): Promise<CredentialFile> {
  return JSON.parse(await fsp.readFile(filePath, 'utf8')) as CredentialFile;
}

/** Write a credential file atomically (temp file, then rename). */
export async function writeCredential(
  filePath: string,
  cred: CredentialFile,
): Promise<void> {
  const tmpPath = filePath + '.tmp';
  await fsp.writeFile(tmpPath, JSON.stringify(cred, null, 2), 'utf8');
  await fsp.rename(tmpPath, filePath);
}

/**
 * Exchange `refreshToken` at the credential's token URL. Returns the
 * updated credential (not yet written), keeping the stored refresh token,
 * expiry and scope when the response omits them, or null when the token
 * endpoint refuses. Throws on network or parse failures.
 */
export async function refreshCredential(
  cred: CredentialFile,
  refreshToken: string,
): Promise<CredentialFile | null> {
  const params = new URLSearchParams();
  params.set('grant_type', 'refresh_token');
  params.set('refresh_token', refreshToken);
  params.set('client_id', cred.clientId);
  params.set('client_secret', cred.clientSecret);

  const response = await fetch(cred.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  if (!response.ok) return null;

  const tokenData = (await response.json()) as Record<string, unknown>;
  const updated: CredentialFile = {
    ...cred,
    access_token: tokenData.access_token as string,
    token_type: (tokenData.token_type as string | undefined) ?? cred.token_type,
    obtained_at: new Date().toISOString(),
  };
  if (tokenData.refresh_token) {
    updated.refresh_token = tokenData.refresh_token as string;
  }
  if (tokenData.expires_in !== undefined) {
    updated.expires_in = tokenData.expires_in as number;
  }
  if (tokenData.scope !== undefined) {
    updated.scope = tokenData.scope as string;
  }
  return updated;
}
