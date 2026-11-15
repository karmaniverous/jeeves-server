/**
 * Every error jeeves-server means a caller to see, as a jeeves `defineError` class (#315, Decision 4): a `SERVER_*` code from core's `SERVER_ERROR_CODES`, the status core's `SERVER_ERROR_STATUS` gives it and a caller-facing message. `registerErrorHandlers` (and, from T9, jeeves' catalog scope) sends them as Fastify's standard error body `{ statusCode, code, error, message }`; anything else thrown is a logged, masked 500 with no code. Pure.
 *
 * @remarks
 * Classes whose message is `%s` take it as their one argument, so each
 * route keeps the message it has always sent; the others carry a fixed
 * message. Never put internals (file system paths, hosts, credentials,
 * library error text) in a message, and cap anything the caller supplied
 * with {@link capArg}.
 *
 * @packageDocumentation
 */

import { defineError } from '@karmaniverous/jeeves/fastify';

/** Longest caller-supplied `%s` argument a message carries. */
export const MESSAGE_ARG_MAX = 300;

/**
 * Cap a caller-supplied message argument at {@link MESSAGE_ARG_MAX}
 * characters (code points, so a surrogate pair is never split; an ellipsis
 * marks a cut). Pure.
 *
 * @param value - The argument.
 * @returns It, at most {@link MESSAGE_ARG_MAX} characters long.
 */
export function capArg(value: string): string {
  const chars = Array.from(value);
  return chars.length <= MESSAGE_ARG_MAX
    ? value
    : `${chars.slice(0, MESSAGE_ARG_MAX - 1).join('')}…`;
}

/** No valid credential for the route; `%s` says which one was expected. */
export const Unauthorized = defineError('SERVER_UNAUTHORIZED', '%s', 401);

/** The caller is known but may not use the route (e.g. an admin route). */
export const Forbidden = defineError('SERVER_FORBIDDEN', '%s', 403);

/** A path outside the caller's scopes. */
export const OutOfScope = defineError(
  'SERVER_OUT_OF_SCOPE',
  'Path is outside your access scope',
  403,
);

/** A share credential on a route that needs an insider. */
export const InsiderRequired = defineError(
  'SERVER_INSIDER_REQUIRED',
  '%s',
  403,
);

/** An empty path, a `..` segment or a path that must be absolute. */
export const InvalidPath = defineError('SERVER_INVALID_PATH', '%s', 400);

/** Nothing there: file, directory, page, route or credential. */
export const NotFound = defineError('SERVER_NOT_FOUND', '%s', 404);

/** A file route addressed a directory. */
export const NotAFile = defineError('SERVER_NOT_A_FILE', '%s', 400);

/** A directory route addressed a file. */
export const NotADirectory = defineError('SERVER_NOT_A_DIRECTORY', '%s', 400);

/** No export in that format for that path. */
export const ExportUnsupported = defineError(
  'SERVER_EXPORT_UNSUPPORTED',
  '%s',
  400,
);

/** The document or diagram did not render. */
export const ExportFailed = defineError('SERVER_EXPORT_FAILED', '%s', 502);

/** The directory exceeds `maxZipSizeMb`; the arguments are both sizes in MB. */
export const ArchiveTooLarge = defineError(
  'SERVER_ARCHIVE_TOO_LARGE',
  'Directory too large for archive export (%sMB, max %sMB)',
  413,
);

/** No usable Chrome for an export. */
export const ChromeUnavailable = defineError(
  'SERVER_CHROME_UNAVAILABLE',
  'Export unavailable: Chrome could not be started (check chromePath)',
  503,
);

/** jeeves-watcher failed or could not be reached. */
export const WatcherUnavailable = defineError(
  'SERVER_WATCHER_UNAVAILABLE',
  '%s',
  502,
);

/** jeeves-runner could not be reached. */
export const RunnerUnavailable = defineError(
  'SERVER_RUNNER_UNAVAILABLE',
  'Runner unreachable',
  503,
);

/** Key rotation with a machine key: machine seeds rotate through config. */
export const MachineKeyNotRotatable = defineError(
  'SERVER_MACHINE_KEY_NOT_ROTATABLE',
  'Machine keys are rotated in the server config, not through this route',
  403,
);

/** The sign-in email could not be sent. */
export const EmailUnavailable = defineError(
  'SERVER_EMAIL_UNAVAILABLE',
  'The sign-in email could not be sent',
  500,
);

/** The server has no `_internal` key, which the route needs. */
export const InternalKeyMissing = defineError(
  'SERVER_INTERNAL_KEY_MISSING',
  'Unavailable: no _internal key is configured',
  500,
);

/** A change raced another change to the same file. */
export const Conflict = defineError('SERVER_CONFLICT', '%s', 409);

/** Sign-in refused for that account; `%s` names the reason (#304). */
export const SignInRejected = defineError('SERVER_SIGN_IN_REJECTED', '%s', 403);

/** A request field the route checks itself is missing or invalid. */
export const InvalidRequest = defineError('SERVER_INVALID_REQUEST', '%s', 400);

/** The feature the route serves is not configured on this server. */
export const NotConfigured = defineError('SERVER_NOT_CONFIGURED', '%s', 501);

/** A stored OAuth credential expired and could not be refreshed. */
export const OAuthRefreshFailed = defineError(
  'SERVER_OAUTH_REFRESH_FAILED',
  'Re-authorization required',
  401,
);
