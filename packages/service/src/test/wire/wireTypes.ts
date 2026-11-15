/**
 * Shapes of a wire scenario, its credential and its recorded reply, and the builders the scenario lists use. Pure.
 *
 * Scenario URLs and share paths use the placeholders `{root}` (the content
 * root's URL path, without its leading slash) and `{fsroot}` (the content
 * root's filesystem path, URI-encoded); `wireRun` expands them, because
 * both differ between Windows and Linux.
 *
 * @packageDocumentation
 */

/** A login-seed identity configured in the wire config. */
export type WireInsider = 'admin' | 'scoped';

/** A machine key configured in the wire config. */
export type WireMachine = 'primary' | 'scoped' | 'internal';

/** Kinds of share credential (signed by an insider's or a key's seed). */
export type WireShareKind =
  'path' | 'expiring' | 'expired' | 'deep' | 'deepDirs';

/**
 * The credential a scenario sends.
 *
 * - `session`: the `jeeves_session` cookie the server issues for the insider.
 * - `insiderKey`: the insider key derived from the insider's login seed.
 * - `machineKey`: the insider key derived from a machine seed.
 * - `share`: an outsider key for `path`, signed by `signer`.
 * - `apiKey`: the raw machine seed in `X-API-Key` (`/key`, `/insider-key`).
 * - `badKey`: a well-formed key no seed produced.
 */
export type WireCred =
  | { session: WireInsider }
  | { insiderKey: WireInsider }
  | { machineKey: WireMachine }
  | {
      share: WireShareKind;
      /** Decoded content path, with `{root}`. */
      path: string;
      signer?: WireInsider | 'primary';
      /** Deep share depth (default 1). */
      depth?: number;
    }
  | { apiKey: WireMachine | 'unknown' }
  | { badKey: true };

/** What a client sees for one request. */
export interface WireRecord {
  /** HTTP status. */
  status: number;
  /** Recorded headers (content type, disposition, location, ...). */
  headers: Record<string, string>;
  /** Body text, byte for byte (volatile values normalised). */
  body?: string;
  /** Binary bodies: length in bytes. */
  bytes?: number;
  /** Binary bodies other than archives: SHA-256 of the bytes. */
  sha256?: string;
}

/** HTTP methods the scenarios use. */
export type WireMethod = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** One request against the wire app. */
export interface WireScenario {
  /** Unique scenario name (fixture key). */
  name: string;
  /** HTTP method. */
  method: WireMethod;
  /** URL, already encoded, with placeholders. */
  url: string;
  /** JSON body (sent with `content-type: application/json`). */
  payload?: unknown;
  /** Raw body with its content type (instead of `payload`). */
  rawBody?: { contentType: string; body: string };
  /** Credential to send. */
  cred?: WireCred;
  /** Send a URL key as the legacy `key` parameter instead of `k`. */
  legacyKeyParam?: boolean;
  /**
   * Top-level JSON fields replaced by `"{redacted}"`: content the repo's
   * own documents supply (it changes with the docs, not the wire).
   */
  redact?: string[];
  /** Record status and headers only (vendor assets follow their package). */
  omitBody?: boolean;
  /** Requests to send first (e.g. a render that registers a diagram). */
  before?: Omit<WireScenario, 'name' | 'before'>[];
}

/**
 * Build a scenario.
 *
 * @param name - Fixture key.
 * @param method - HTTP method.
 * @param url - Encoded URL.
 * @param extra - Payload, credential or options.
 * @returns The scenario.
 */
export const scenario = (
  name: string,
  method: WireMethod,
  url: string,
  extra: Partial<WireScenario> = {},
): WireScenario => ({ name, method, url, ...extra });

/**
 * Build a GET scenario.
 *
 * @param name - Fixture key.
 * @param url - Encoded URL.
 * @param extra - Credential or options.
 * @returns The scenario.
 */
export const get = (
  name: string,
  url: string,
  extra?: Partial<WireScenario>,
): WireScenario => scenario(name, 'GET', url, extra);

/**
 * Builder for scenarios that send a JSON body.
 *
 * @param method - HTTP method.
 * @returns `(name, url, payload, extra?) => scenario`.
 */
const withBody =
  (method: WireMethod) =>
  (
    name: string,
    url: string,
    payload: unknown,
    extra?: Partial<WireScenario>,
  ): WireScenario =>
    scenario(name, method, url, { payload, ...extra });

/** POST with a JSON body. */
export const post = withBody('POST');
/** PUT with a JSON body. */
export const put = withBody('PUT');

/**
 * Scenario options carrying a credential, or none.
 *
 * @param cred - Credential (none when undefined).
 * @returns `{ cred }` or `{}`.
 */
export const withCred = (cred: WireCred | undefined): Partial<WireScenario> =>
  cred ? { cred } : {};

/**
 * Typed table rows (keeps tuple element types for `.map`).
 *
 * @param rows - Rows.
 * @returns The rows.
 */
export const table = <T extends unknown[]>(...rows: T[]): T[] => rows;

/** Credential shorthands used across the scenario lists. */
export const CRED = {
  session: { session: 'admin' },
  scopedSession: { session: 'scoped' },
  insider: { insiderKey: 'admin' },
  scopedInsider: { insiderKey: 'scoped' },
  machine: { machineKey: 'primary' },
  scopedMachine: { machineKey: 'scoped' },
  bad: { badKey: true },
} as const satisfies Record<string, WireCred>;

/**
 * A share credential for `path`.
 *
 * @param share - Kind of share.
 * @param path - Decoded content path with `{root}`.
 * @param extra - Signer or depth.
 * @returns The credential.
 */
export const shareCred = (
  share: WireShareKind,
  path: string,
  extra: { signer?: WireInsider | 'primary'; depth?: number } = {},
): WireCred => ({ share, path, ...extra });
