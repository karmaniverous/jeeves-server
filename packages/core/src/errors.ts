/**
 * The client's half of the server error contract (#315): every `SERVER_*` code an error body can carry (`SERVER_ERROR_CODES`) and the HTTP status each is sent with (`SERVER_ERROR_STATUS`). The body is Fastify's standard error body (`errorBodySchema` from `@karmaniverous/jeeves/catalog`). Pure data.
 *
 * @packageDocumentation
 */

/**
 * Every `SERVER_*` code a non-2xx jeeves-server response can carry. The body
 * is `{ statusCode, code?, error, message }`; other codes come from jeeves
 * (`JEEVES_*`) and Fastify (`FST_ERR_*`), and an unexpected failure is a
 * masked 500 with no `code`. The status of each is in
 * {@link SERVER_ERROR_STATUS}.
 *
 * - `SERVER_UNAUTHORIZED` (401): no valid credential for the route.
 * - `SERVER_FORBIDDEN` (403): an admin route called by an identity with
 *   scopes.
 * - `SERVER_OUT_OF_SCOPE` (403): a path outside the caller's scopes.
 * - `SERVER_INSIDER_REQUIRED` (403): a share credential on a route that
 *   needs an insider.
 * - `SERVER_INVALID_PATH` (400): a path that is empty, has a `..` segment or
 *   is not absolute where an absolute path is required.
 * - `SERVER_NOT_FOUND` (404): no file, directory, page, route or credential
 *   there (a path under no configured root included).
 * - `SERVER_NOT_A_FILE` (400): a file route addressed a directory.
 * - `SERVER_NOT_A_DIRECTORY` (400): a directory route addressed a file.
 * - `SERVER_EXPORT_UNSUPPORTED` (400): no export in that format for that
 *   path.
 * - `SERVER_EXPORT_FAILED` (502): the document did not render.
 * - `SERVER_ARCHIVE_TOO_LARGE` (413): the directory exceeds `maxZipSizeMb`.
 * - `SERVER_CHROME_UNAVAILABLE` (503): no usable Chrome for the export.
 * - `SERVER_WATCHER_UNAVAILABLE` (502): jeeves-watcher failed or can't be
 *   reached.
 * - `SERVER_RUNNER_UNAVAILABLE` (503): jeeves-runner can't be reached.
 * - `SERVER_MACHINE_KEY_NOT_ROTATABLE` (403): `rotateKey` with a machine
 *   key (machine seeds rotate through config).
 * - `SERVER_EMAIL_UNAVAILABLE` (500): the sign-in email could not be sent.
 * - `SERVER_INTERNAL_KEY_MISSING` (500): no `_internal` key is configured.
 * - `SERVER_CONFLICT` (409): a block edit raced another change.
 * - `SERVER_SIGN_IN_REJECTED` (403): sign-in refused for that account.
 * - `SERVER_INVALID_REQUEST` (400): a request field is missing or invalid in
 *   a way the route checks itself (a line range, an action's fields, an
 *   OAuth origin).
 * - `SERVER_NOT_CONFIGURED` (501): the feature the route serves is not
 *   configured on this server (OAuth).
 * - `SERVER_OAUTH_REFRESH_FAILED` (401): a stored OAuth credential expired
 *   and could not be refreshed; the account must be authorized again.
 */
export const SERVER_ERROR_CODES = [
  'SERVER_UNAUTHORIZED',
  'SERVER_FORBIDDEN',
  'SERVER_OUT_OF_SCOPE',
  'SERVER_INSIDER_REQUIRED',
  'SERVER_INVALID_PATH',
  'SERVER_NOT_FOUND',
  'SERVER_NOT_A_FILE',
  'SERVER_NOT_A_DIRECTORY',
  'SERVER_EXPORT_UNSUPPORTED',
  'SERVER_EXPORT_FAILED',
  'SERVER_ARCHIVE_TOO_LARGE',
  'SERVER_CHROME_UNAVAILABLE',
  'SERVER_WATCHER_UNAVAILABLE',
  'SERVER_RUNNER_UNAVAILABLE',
  'SERVER_MACHINE_KEY_NOT_ROTATABLE',
  'SERVER_EMAIL_UNAVAILABLE',
  'SERVER_INTERNAL_KEY_MISSING',
  'SERVER_CONFLICT',
  'SERVER_SIGN_IN_REJECTED',
  'SERVER_INVALID_REQUEST',
  'SERVER_NOT_CONFIGURED',
  'SERVER_OAUTH_REFRESH_FAILED',
] as const;

/** A `SERVER_*` error code. */
export type ServerErrorCode = (typeof SERVER_ERROR_CODES)[number];

/** The HTTP status each `SERVER_*` code is sent with (one per code). */
export const SERVER_ERROR_STATUS: Readonly<Record<ServerErrorCode, number>> = {
  SERVER_UNAUTHORIZED: 401,
  SERVER_FORBIDDEN: 403,
  SERVER_OUT_OF_SCOPE: 403,
  SERVER_INSIDER_REQUIRED: 403,
  SERVER_INVALID_PATH: 400,
  SERVER_NOT_FOUND: 404,
  SERVER_NOT_A_FILE: 400,
  SERVER_NOT_A_DIRECTORY: 400,
  SERVER_EXPORT_UNSUPPORTED: 400,
  SERVER_EXPORT_FAILED: 502,
  SERVER_ARCHIVE_TOO_LARGE: 413,
  SERVER_CHROME_UNAVAILABLE: 503,
  SERVER_WATCHER_UNAVAILABLE: 502,
  SERVER_RUNNER_UNAVAILABLE: 503,
  SERVER_MACHINE_KEY_NOT_ROTATABLE: 403,
  SERVER_EMAIL_UNAVAILABLE: 500,
  SERVER_INTERNAL_KEY_MISSING: 500,
  SERVER_CONFLICT: 409,
  SERVER_SIGN_IN_REJECTED: 403,
  SERVER_INVALID_REQUEST: 400,
  SERVER_NOT_CONFIGURED: 501,
  SERVER_OAUTH_REFRESH_FAILED: 401,
};
