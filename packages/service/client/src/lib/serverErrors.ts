/**
 * What the SPA shows for a failed call: the text for a `ServerError`,
 * chosen by its `code` (the server's message for server codes, a fixed text
 * for client-side failures), and the search panel's own wording. Pure.
 */

import { isServerError } from '@karmaniverous/jeeves-server-sdk';

/**
 * Text of a `SERVER_UNAUTHORIZED` failure. The render state reads it to
 * report `auth-required` to the export renderer.
 */
export const UNAUTHORIZED_MESSAGE = 'Unauthorized';

/** Fixed texts for failures without a server message. */
const CLIENT_MESSAGES: Readonly<Record<string, string>> = {
  SERVER_UNAUTHORIZED: UNAUTHORIZED_MESSAGE,
  timeout: 'The server took too long to respond.',
  network_error: 'The server could not be reached.',
  invalid_response: 'The server sent an unexpected response.',
};

/**
 * Whether a failure means the caller has no valid credential.
 *
 * @param error - What a call threw.
 * @returns True for a `ServerError` with code `SERVER_UNAUTHORIZED`.
 */
export function isUnauthorized(error: unknown): boolean {
  return isServerError(error) && error.code === 'SERVER_UNAUTHORIZED';
}

/**
 * The text to show for a failure.
 *
 * @param error - What a call threw.
 * @param fallback - Text for a thrown value that isn't an `Error`.
 * @returns A fixed text for `SERVER_UNAUTHORIZED` and client-side failures,
 *   else the error's message.
 */
export function errorMessage(
  error: unknown,
  fallback = 'Something went wrong',
): string {
  if (isServerError(error)) return CLIENT_MESSAGES[error.code] ?? error.message;
  return error instanceof Error ? error.message : fallback;
}

/** Search panel texts by failure code. */
const SEARCH_MESSAGES: Readonly<Record<string, string>> = {
  SERVER_WATCHER_UNAVAILABLE:
    'Search service is unavailable. Please try again later.',
  SERVER_NOT_CONFIGURED: 'Search is not configured on this server.',
  SERVER_FORBIDDEN: 'You do not have permission to search.',
  SERVER_INSIDER_REQUIRED: 'You do not have permission to search.',
  SERVER_OUT_OF_SCOPE: 'You do not have permission to search.',
  SERVER_INVALID_REQUEST: 'Invalid search query. Please revise and try again.',
  invalid_request: 'Invalid search query. Please revise and try again.',
};

/**
 * The search panel's text for a failed search.
 *
 * @param error - What the search threw.
 * @returns The text for its code, else a generic failure.
 */
export function searchErrorMessage(error: unknown): string {
  return (
    (isServerError(error) ? SEARCH_MESSAGES[error.code] : undefined) ??
    'Search failed. Please try again later.'
  );
}
