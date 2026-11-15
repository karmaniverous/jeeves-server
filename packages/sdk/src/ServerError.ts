/**
 * The single error class the SDK throws: invalid options or input, timeouts, network failures, non-2xx responses and unusable responses. Pure.
 *
 * @packageDocumentation
 */

import type { ErrorBody } from '@karmaniverous/jeeves/catalog';
import type { ServerErrorCode } from '@karmaniverous/jeeves-server-core/catalog';

/**
 * Codes the SDK assigns itself (lower case, so they never collide with a
 * server code). All carry status 0. An error from a non-2xx response carries
 * the server's code instead: the body's `code` (a `SERVER_*` code from
 * `SERVER_ERROR_CODES`, a jeeves `JEEVES_*` code or a Fastify `FST_ERR_*`
 * code), else `http_<status>` (a masked 500, a body that isn't Fastify's).
 *
 * - `invalid_options`: {@link createServerClient} options, or a link
 *   helper's arguments, are invalid.
 * - `invalid_request`: the input failed the catalog entry's request schema;
 *   nothing was sent.
 * - `invalid_response`: a 2xx response was not JSON or failed the entry's
 *   response schema.
 * - `timeout`: no response within the call's timeout.
 * - `network_error`: `fetch` rejected (connection refused, DNS failure, ...).
 */
export type ServerClientErrorCode =
  | 'invalid_options'
  | 'invalid_request'
  | 'invalid_response'
  | 'timeout'
  | 'network_error';

/**
 * What {@link ServerError.code} holds: a server code, a client code,
 * `http_<status>`, or any other code a response carries (`JEEVES_*`,
 * `FST_ERR_*`); the named ones autocomplete.
 */
export type ServerErrorCodeValue =
  ServerErrorCode | ServerClientErrorCode | `http_${number}` | (string & {});

/** Constructor fields of a {@link ServerError}. */
export interface ServerErrorInit {
  /** The server's code, `http_<status>` or a {@link ServerClientErrorCode}. */
  code: ServerErrorCodeValue;
  /** Human-readable message (a response's: the body's `message`). */
  message: string;
  /** HTTP status when a response arrived, else 0. */
  status: number;
  /** Milliseconds to wait before retrying, from a `Retry-After` header. */
  retryAfterMs?: number;
  /** Parsed error body of a non-2xx response. */
  body?: ErrorBody;
  /** Zod issues of an `invalid_request` or `invalid_response`. */
  issues?: unknown;
  /** Underlying error, if any. */
  cause?: unknown;
}

/**
 * The one error type thrown by every SDK call. The SDK never retries; branch
 * on `code` (e.g. `SERVER_OUT_OF_SCOPE`, `SERVER_NOT_FOUND`), never on
 * `message`; `status` is the HTTP status (0 when no usable response
 * arrived).
 */
export class ServerError extends Error {
  /**
   * Machine-readable code: the response body's `code` (`SERVER_*`,
   * `JEEVES_*`, `FST_ERR_*`), else `http_<status>`, or a
   * {@link ServerClientErrorCode} when no usable response arrived.
   */
  readonly code: ServerErrorCodeValue;
  /** HTTP status when a response arrived, else 0. */
  readonly status: number;
  /**
   * Milliseconds to wait before retrying, from the response's `Retry-After`
   * (sent with 429 and 503); absent when the header is missing.
   */
  readonly retryAfterMs?: number;
  /**
   * Parsed error body of a non-2xx response: Fastify's standard body
   * `{ statusCode, code?, error, message }`.
   */
  readonly body?: ErrorBody;
  /** Zod issues of an `invalid_request` or `invalid_response`. */
  readonly issues?: unknown;

  /**
   * Create a server error.
   *
   * @param init - Code, message, status and optional retry delay, body, issues and cause.
   */
  constructor(init: ServerErrorInit) {
    super(init.message, init.cause === undefined ? {} : { cause: init.cause });
    this.name = 'ServerError';
    this.code = init.code;
    this.status = init.status;
    this.retryAfterMs = init.retryAfterMs;
    this.body = init.body;
    this.issues = init.issues;
  }
}

/**
 * Type guard for {@link ServerError}.
 *
 * @param value - Any value (typically a caught error).
 * @returns `true` when `value` is a {@link ServerError}.
 */
export function isServerError(value: unknown): value is ServerError {
  return value instanceof ServerError;
}

/**
 * A client-side `invalid_options` error.
 *
 * @param message - What is wrong.
 * @returns The error (status 0).
 */
export const invalidOptions = (message: string): ServerError =>
  new ServerError({ code: 'invalid_options', status: 0, message });
