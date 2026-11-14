/**
 * Turns a scenario's {@link WireCred} into what the request carries (URL query, cookie or header), deriving keys and sessions with the server's own functions. Pure apart from reading the wire paths.
 *
 * @packageDocumentation
 */

import { createSessionCookie } from '../../auth/session.js';
import { createDeepShare, createPathShare } from '../../services/shareLinks.js';
import { computeInsiderKey } from '../../util/crypto.js';
import type { WireApp } from './wireApp.js';
import {
  WIRE_EMAILS,
  WIRE_FUTURE_EXP,
  WIRE_PAST_EXP,
  WIRE_SEEDS,
  WIRE_SESSION_SECRET,
} from './wireFixture.js';
import type { WireCred, WireInsider, WireMachine } from './wireTypes.js';

/** What a request carries for its credential. */
export interface WireCredential {
  /** URL query to append (without `?`). */
  query?: string;
  /** Request headers. */
  headers: Record<string, string>;
}

/** Seed of each machine key. */
const MACHINE_SEEDS: Record<WireMachine, string> = {
  primary: WIRE_SEEDS.primary,
  scoped: WIRE_SEEDS.scopedKey,
  internal: WIRE_SEEDS.internal,
};

/** Seed of each insider. */
const INSIDER_SEEDS: Record<WireInsider, string> = {
  admin: WIRE_SEEDS.admin,
  scoped: WIRE_SEEDS.scoped,
};

/**
 * The query string of a generated `/browse` share URL. The deep-share stack
 * alphabet contains `+`, which the server writes percent-encoded (the
 * branch base wrote it raw, and the baseline was recorded with it encoded,
 * as a URL-encoding client sends it, so it is deterministic on hosts whose
 * content root path compresses to a stack with `+`).
 *
 * @param url - Share URL.
 * @returns Everything after `?`.
 */
const queryOf = (url: string): string => url.slice(url.indexOf('?') + 1);

/**
 * The request parts for a credential.
 *
 * @param cred - The scenario's credential (none when undefined).
 * @param wire - The wire app (content root URL).
 * @returns Query and headers.
 */
export function credentialFor(
  cred: WireCred | undefined,
  wire: Pick<WireApp, 'rootUrl'>,
): WireCredential {
  if (!cred) return { headers: {} };
  if ('session' in cred) {
    const cookie = createSessionCookie(
      WIRE_EMAILS[cred.session],
      WIRE_SESSION_SECRET,
    );
    return { headers: { cookie: `jeeves_session=${cookie}` } };
  }
  if ('insiderKey' in cred)
    return {
      query: `k=${computeInsiderKey(INSIDER_SEEDS[cred.insiderKey])}`,
      headers: {},
    };
  if ('machineKey' in cred)
    return {
      query: `k=${computeInsiderKey(MACHINE_SEEDS[cred.machineKey])}`,
      headers: {},
    };
  if ('apiKey' in cred)
    return {
      headers: {
        'x-api-key':
          cred.apiKey === 'unknown' ? 'not-a-seed' : MACHINE_SEEDS[cred.apiKey],
      },
    };
  if ('badKey' in cred) return { query: `k=${'0'.repeat(32)}`, headers: {} };

  const signer = cred.signer ?? 'admin';
  const seed =
    signer === 'primary' ? WIRE_SEEDS.primary : INSIDER_SEEDS[signer];
  const target = cred.path.split('{root}').join(wire.rootUrl.slice(1));
  const depth = cred.depth ?? 1;
  const share = {
    path: () => createPathShare(seed, target),
    expiring: () => createPathShare(seed, target, WIRE_FUTURE_EXP),
    expired: () => createPathShare(seed, target, WIRE_PAST_EXP),
    deep: () => createDeepShare(seed, target, { depth, dirs: false }),
    deepDirs: () => createDeepShare(seed, target, { depth, dirs: true }),
  }[cred.share]();
  return { query: queryOf(share.url), headers: {} };
}
