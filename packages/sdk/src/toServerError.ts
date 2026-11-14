/**
 * The one mapping from what jeeves' catalog client throws to {@link ServerError}: a response keeps its HTTP status, its body's `code` (else `http_<status>`), its body's `message` and its `Retry-After`; client-side failures get the SDK's own codes and status 0. Pure.
 *
 * @packageDocumentation
 */

import { CatalogClientError } from '@karmaniverous/jeeves/catalog';

import { ServerError } from './ServerError.js';

/**
 * Message of an underlying error.
 *
 * @param cause - Anything thrown.
 * @returns Its message, or its string form.
 */
const messageOf = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause);

/**
 * A string field of an error body, treating empty as absent.
 *
 * @param value - The field.
 * @returns It, or `undefined` when missing or empty.
 */
const nonEmpty = (value: string | undefined): string | undefined =>
  value === '' ? undefined : value;

/**
 * The error for a non-2xx response.
 *
 * @param error - The catalog client's error (status 300 or more).
 * @returns The server error.
 */
function fromResponse(error: CatalogClientError): ServerError {
  return new ServerError({
    code: nonEmpty(error.code) ?? `http_${String(error.status)}`,
    status: error.status,
    message:
      nonEmpty(error.body?.message) ??
      nonEmpty(error.body?.error) ??
      `HTTP ${String(error.status)}`,
    ...(error.retryAfterMs === undefined
      ? {}
      : { retryAfterMs: error.retryAfterMs }),
    ...(error.body === undefined ? {} : { body: error.body }),
    cause: error,
  });
}

/**
 * The error for a failure that produced no usable response.
 *
 * @param error - The catalog client's error (no non-2xx status).
 * @param operation - Catalog entry name.
 * @param timeoutMs - The call's timeout.
 * @returns The server error (status 0).
 */
function fromClient(
  error: CatalogClientError,
  operation: string,
  timeoutMs: number,
): ServerError {
  if (error.issues !== undefined) {
    const responded = error.status > 0;
    return new ServerError({
      code: responded ? 'invalid_response' : 'invalid_request',
      status: 0,
      message: responded
        ? `${operation} response did not match the expected shape`
        : error.message,
      issues: error.issues,
      cause: error,
    });
  }
  const { cause } = error;
  if (cause instanceof Error && cause.name === 'TimeoutError')
    return new ServerError({
      code: 'timeout',
      status: 0,
      message: `${operation} timed out after ${String(timeoutMs)} ms`,
      cause: error,
    });
  if (cause instanceof SyntaxError)
    return new ServerError({
      code: 'invalid_response',
      status: 0,
      message: `${operation} returned a response that is not JSON`,
      cause: error,
    });
  return new ServerError({
    code: 'network_error',
    status: 0,
    message: `${operation} request failed: ${messageOf(cause)}`,
    cause: error,
  });
}

/**
 * Convert a failed catalog call to a {@link ServerError}.
 *
 * @param error - What the catalog client threw.
 * @param operation - Catalog entry name (used in messages).
 * @param timeoutMs - The call's timeout (used in the timeout message).
 * @returns The error to throw.
 */
export function toServerError(
  error: unknown,
  operation: string,
  timeoutMs: number,
): ServerError {
  if (!(error instanceof CatalogClientError))
    return new ServerError({
      code: 'network_error',
      status: 0,
      message: `${operation} request failed: ${messageOf(error)}`,
      cause: error,
    });
  return error.status >= 300
    ? fromResponse(error)
    : fromClient(error, operation, timeoutMs);
}
