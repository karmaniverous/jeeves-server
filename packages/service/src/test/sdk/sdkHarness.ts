/**
 * SDK clients against the real app: the wire app (`registerServerApp` over the wire corpus and config) reached through an `app.inject`-backed `fetch`, so every request goes through the real routes, access hook and error handling without a socket. A client with `credentials: 'same-origin'` carries the admin's session cookie, as a browser would.
 *
 * @packageDocumentation
 */

import {
  createServerClient,
  type FetchLike,
  type ServerAuth,
  type ServerClient,
} from '@karmaniverous/jeeves-server-sdk';
import type { FastifyInstance } from 'fastify';

import { createSessionCookie } from '../../auth/session.js';
import { computeInsiderKey } from '../../util/crypto.js';
import {
  WIRE_EMAILS,
  WIRE_SEEDS,
  WIRE_SESSION_SECRET,
} from '../wire/wireFixture.js';

/** Base URL the clients address (never contacted: requests are injected). */
export const SDK_BASE_URL = 'http://jeeves.test';

/** Statuses whose responses carry no body. */
const NULL_BODY = new Set([204, 205, 304]);

/** The admin insider's session cookie, as the server issues it. */
const sessionCookie = (): string =>
  `jeeves_session=${createSessionCookie(WIRE_EMAILS.admin, WIRE_SESSION_SECRET)}`;

/**
 * A `fetch` that injects each request into the app.
 *
 * @param app - The app.
 * @returns The fetch.
 */
export function injectFetch(app: FastifyInstance): FetchLike {
  return async (input, init) => {
    const url = new URL(input);
    const headers = new Headers(init.headers);
    if (init.credentials === 'same-origin')
      headers.set('cookie', sessionCookie());
    const res = await app.inject({
      method: (init.method ?? 'GET') as 'GET',
      url: url.pathname + url.search,
      headers: Object.fromEntries(headers),
      ...(typeof init.body === 'string' ? { payload: init.body } : {}),
    });
    const replyHeaders = new Headers();
    for (const [name, value] of Object.entries(res.headers))
      for (const v of [value ?? []].flat())
        replyHeaders.append(name, String(v));
    return new Response(
      NULL_BODY.has(res.statusCode) ? null : new Uint8Array(res.rawPayload),
      {
        status: res.statusCode,
        headers: replyHeaders,
      },
    );
  };
}

/** The keys the clients use. */
export const SDK_KEYS = {
  /** The unscoped `primary` machine key: an admin identity. */
  admin: computeInsiderKey(WIRE_SEEDS.primary),
  /** The `scoped` machine key (scope `public`). */
  scoped: computeInsiderKey(WIRE_SEEDS.scopedKey),
  /** The admin insider's login-seed key (`shareFor`, `rotateKey` only). */
  loginSeed: computeInsiderKey(WIRE_SEEDS.admin),
};

/**
 * An SDK client of the app.
 *
 * @param app - The app.
 * @param auth - Credential (none when omitted).
 * @returns The client.
 */
export function sdkClient(
  app: FastifyInstance,
  auth?: ServerAuth,
): ServerClient {
  return createServerClient({
    baseUrl: SDK_BASE_URL,
    fetch: injectFetch(app),
    ...(auth ? { auth } : {}),
  });
}

/**
 * The rejection of a call, for asserting a `ServerError`.
 *
 * @param call - The pending call.
 * @returns What it rejected with.
 */
export async function failure(call: Promise<unknown>): Promise<unknown> {
  try {
    await call;
  } catch (error) {
    return error;
  }
  throw new Error('the call succeeded');
}
