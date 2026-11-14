/**
 * Client options for `createServerClient`, their defaults and their validation. Pure apart from wrapping `fetch`.
 *
 * @packageDocumentation
 */

import {
  checkAuth,
  type FetchLike,
  type ServerAuth,
  withAuth,
} from './auth.js';
import { invalidOptions } from './ServerError.js';

/** Default per-call timeout: 120 s, jeeves' `DEFAULT_FETCH_TIMEOUT_MS`. */
export const DEFAULT_TIMEOUT_MS = 120_000;

/**
 * Default timeout of `export`: 10 minutes, the server's render budget (cold
 * Chrome starts, large PDF/DOCX renders and archives).
 */
export const EXPORT_TIMEOUT_MS = 600_000;

/** Options for `createServerClient`. */
export interface ServerClientOptions {
  /**
   * Base URL of the server, e.g. `http://127.0.0.1:1934`. May carry a path
   * prefix; must not carry a query string or fragment.
   */
  baseUrl: string;
  /** Credential. Default: none (public entries only). */
  auth?: ServerAuth;
  /** Per-call timeout in milliseconds for every entry but `export`. Default: 120000. */
  timeoutMs?: number;
  /** `fetch` implementation (for tests or custom agents). Default: global `fetch`. */
  fetch?: FetchLike;
}

/** Validated, normalised client options. */
export interface ResolvedClientOptions {
  /** Base URL without trailing slashes. */
  baseUrl: string;
  /** The credential, checked. */
  auth?: ServerAuth;
  /** Default timeout. */
  timeoutMs: number;
  /** The caller's fetch, applying a share or session credential. */
  fetch: typeof fetch;
}

/**
 * Check a timeout.
 *
 * @param name - Option name (for the message).
 * @param value - The value.
 * @returns The value.
 * @throws {@link ServerError} `invalid_options` unless positive and finite.
 */
export function checkTimeout(name: string, value: number): number {
  if (!Number.isFinite(value) || value <= 0)
    throw invalidOptions(`${name} must be a positive number`);
  return value;
}

/**
 * Validate and normalise client options.
 *
 * @param options - Caller options.
 * @returns Resolved options.
 * @throws {@link ServerError} `invalid_options` on a bad base URL (not
 *   http(s), or carrying a query string or fragment), a bad credential, a
 *   non-positive timeout or no `fetch`.
 */
export function resolveClientOptions(
  options: ServerClientOptions,
): ResolvedClientOptions {
  const { baseUrl } = options;
  if (!URL.canParse(baseUrl) || !/^https?:$/.test(new URL(baseUrl).protocol))
    throw invalidOptions(`baseUrl must be an http(s) URL, got "${baseUrl}"`);
  // Entry paths are appended to baseUrl, so a query or fragment would
  // swallow them. Check the raw string: URL drops an empty `?` or `#`.
  if (/[?#]/.test(baseUrl))
    throw invalidOptions(
      `baseUrl must not contain a query string or fragment, got "${baseUrl}"`,
    );
  const fetchImpl =
    options.fetch ?? (globalThis as { fetch?: FetchLike }).fetch;
  if (fetchImpl === undefined)
    throw invalidOptions(
      'No fetch implementation available; pass options.fetch',
    );
  const auth = options.auth === undefined ? undefined : checkAuth(options.auth);
  return {
    baseUrl: baseUrl.replace(/\/+$/, ''),
    ...(auth === undefined ? {} : { auth }),
    timeoutMs: checkTimeout(
      'timeoutMs',
      options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    ),
    fetch: withAuth(fetchImpl, auth),
  };
}
