/**
 * jeeves-watcher access: a `@karmaniverous/jeeves-watcher-sdk` client at the
 * core-resolved watcher URL with a per-call budget, the watcher's path
 * form, and the reading of a failed call (reached or unreachable, and the
 * transport error behind it). No I/O beyond the client itself.
 *
 * @packageDocumentation
 */

import { getServiceUrl } from '@karmaniverous/jeeves';
import { CatalogClientError } from '@karmaniverous/jeeves/catalog';
import {
  createWatcherClient,
  isWatcherError,
  type WatcherClient,
  type WatcherError,
} from '@karmaniverous/jeeves-watcher-sdk';

/** Budgets (ms) for each watcher call the server makes. */
export const WATCHER_TIMEOUT_MS = {
  /** `POST /render`: the file view degrades to Raw-only past it. */
  render: 5_000,
  /** `POST /search`: embedding plus vector search. */
  search: 30_000,
  /** `GET /search/facets`. */
  facets: 15_000,
} as const;

/**
 * A watcher client at the watcher URL core resolves now (config may change
 * between calls).
 *
 * @param timeoutMs - Per-request budget.
 * @returns The client. Throws `WatcherError` `invalid_options` on a bad URL.
 */
export function watcherClient(timeoutMs: number): WatcherClient {
  return createWatcherClient({ baseUrl: getServiceUrl('watcher'), timeoutMs });
}

/**
 * A file system path in the form the watcher indexes: forward slashes and
 * a lower-case drive letter.
 *
 * @param fsPath - Absolute file system path.
 * @returns The watcher path.
 */
export function toWatcherPath(fsPath: string): string {
  return fsPath
    .replace(/\\/g, '/')
    .replace(/^([A-Z]):/, (_: string, d: string) => d.toLowerCase() + ':');
}

/**
 * Whether a failed watcher call got an answer: an HTTP response (any
 * status) or a request the SDK refused to send. Anything else (network
 * failure, timeout, bad URL) means the watcher was not reached.
 *
 * @param err - What the call threw.
 * @returns `true` when the watcher answered or the request was invalid.
 */
export function watcherAnswered(err: unknown): err is WatcherError {
  return (
    isWatcherError(err) &&
    (err.status !== undefined || err.code === 'invalid_request')
  );
}

/**
 * The error the request itself failed with (fetch's `TypeError`, a timeout
 * abort), unwrapped from the SDK's `WatcherError` and jeeves's catalog
 * error; the error itself when there is nothing to unwrap.
 *
 * @param err - What the call threw.
 * @returns The transport error.
 */
export function transportCause(err: unknown): unknown {
  if (!isWatcherError(err)) return err;
  const inner = err.cause;
  if (inner instanceof CatalogClientError) return inner.cause ?? inner;
  return inner ?? err;
}

/**
 * The message of {@link transportCause}.
 *
 * @param err - What the call threw.
 * @returns The transport error's message, or its string form.
 */
export function transportMessage(err: unknown): string {
  const cause = transportCause(err);
  return cause instanceof Error ? cause.message : String(cause);
}
