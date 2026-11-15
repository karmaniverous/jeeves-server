/**
 * The SPA's API client: one SDK `ServerClient` on the page's origin with the
 * page's credential (a share credential from the URL, else the browser
 * session), and a view of it that sends the browser to sign-in when a call
 * finds no valid credential. No I/O until a method is called.
 */

import {
  createServerClient,
  type ServerClient,
  type ShareCredential,
} from '@karmaniverous/jeeves-server-sdk';

import { pageAuth } from './pageAuth';
import { isUnauthorized } from './serverErrors';

/** What the app client is built from. */
export interface AppClientOptions {
  /** The page's origin (`window.location.origin`). */
  origin: string;
  /** The page's share credential, if it was opened from a share link. */
  share: ShareCredential | undefined;
}

/**
 * Create the SPA's SDK client. `fetch` is looked up on every call, so the
 * page (and tests) always use the current global.
 *
 * @param options - Origin and share credential.
 * @returns The client.
 */
export function createAppClient({
  origin,
  share,
}: AppClientOptions): ServerClient {
  return createServerClient({
    baseUrl: origin,
    auth: pageAuth(share),
    fetch: (input, init) => globalThis.fetch(input, init),
  });
}

/**
 * A view of `client` whose methods call `onUnauthorized` before rethrowing a
 * `SERVER_UNAUTHORIZED` failure (the SPA sends the browser to sign-in).
 * Other failures pass through unchanged.
 *
 * @param client - The client.
 * @param onUnauthorized - Called on `SERVER_UNAUTHORIZED`.
 * @returns The wrapped client.
 */
export function withSignInRedirect(
  client: ServerClient,
  onUnauthorized: () => void,
): ServerClient {
  const methods = Object.entries(client).map(([name, method]) => {
    const send = method as (...args: unknown[]) => Promise<unknown>;
    const wrapped = async (...args: unknown[]) => {
      try {
        return await send(...args);
      } catch (error) {
        if (isUnauthorized(error)) onUnauthorized();
        throw error;
      }
    };
    return [name, wrapped] as const;
  });
  return Object.fromEntries(methods) as unknown as ServerClient;
}
