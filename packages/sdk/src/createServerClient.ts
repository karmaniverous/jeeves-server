/**
 * Typed jeeves-server API client built on jeeves' catalog client: one method per `SERVER_CATALOG` entry, named by the entry, each taking its input and optional per-call options; every failure is a {@link ServerError}. Network I/O via fetch.
 *
 * @packageDocumentation
 */

import {
  type CatalogClient,
  type CatalogInput,
  type ClientResponse,
  createCatalogClient,
} from '@karmaniverous/jeeves/catalog';
import {
  SERVER_CATALOG,
  type ServerCatalog,
} from '@karmaniverous/jeeves-server-core/catalog';

import { catalogAuth } from './auth.js';
import {
  checkTimeout,
  EXPORT_TIMEOUT_MS,
  resolveClientOptions,
  type ServerClientOptions,
} from './options.js';
import { toServerError } from './toServerError.js';

/** Options for one call. */
export interface CallOptions {
  /** Timeout of this call in milliseconds (overrides the client's). */
  timeoutMs?: number;
}

/** The client method for catalog entry `E`: input optional when no field is required. */
type MethodOf<E extends ServerCatalog['entries'][number]> =
  Partial<CatalogInput<E>> extends CatalogInput<E>
    ? (
        input?: CatalogInput<E>,
        options?: CallOptions,
      ) => Promise<ClientResponse<E>>
    : (
        input: CatalogInput<E>,
        options?: CallOptions,
      ) => Promise<ClientResponse<E>>;

/**
 * A jeeves-server API client: one method per `SERVER_CATALOG` entry, named
 * by the entry (`status`, `browse`, `fileContent`, `share`, `export`, ...).
 * Every method validates its input against the entry's schemas before
 * sending, parses a JSON response with the entry's response schema (binary
 * entries resolve to a `Uint8Array`), and throws a {@link ServerError} on
 * any failure. No retries.
 */
export type ServerClient = {
  [E in ServerCatalog['entries'][number] as E['name']]: MethodOf<E>;
};

/**
 * Create a jeeves-server API client.
 *
 * @example
 * ```ts
 * const server = createServerClient({
 *   baseUrl: 'http://127.0.0.1:1934',
 *   auth: { key: insiderKey },
 * });
 * const listing = await server.browse({ '*': 'j/docs' });
 * ```
 *
 * @param options - Base URL, credential, timeout (default 120 s; `export`
 *   10 min) and `fetch`.
 * @returns A {@link ServerClient}.
 * @throws {@link ServerError} `invalid_options` when the options are invalid.
 */
export function createServerClient(options: ServerClientOptions): ServerClient {
  const resolved = resolveClientOptions(options);
  const auth = catalogAuth(resolved.auth);

  // jeeves' catalog client takes one timeout, so keep one per timeout used.
  const clients = new Map<number, CatalogClient<ServerCatalog>>();
  const clientFor = (timeoutMs: number): CatalogClient<ServerCatalog> => {
    const existing = clients.get(timeoutMs);
    if (existing) return existing;
    const created = createCatalogClient(SERVER_CATALOG, {
      baseUrl: resolved.baseUrl,
      timeoutMs,
      fetch: resolved.fetch,
      ...(auth === undefined ? {} : { auth }),
    });
    clients.set(timeoutMs, created);
    return created;
  };

  const methods = SERVER_CATALOG.entries.map(({ name }) => {
    const defaultTimeout =
      name === 'export' ? EXPORT_TIMEOUT_MS : resolved.timeoutMs;
    const method = async (input?: unknown, call: CallOptions = {}) => {
      const timeoutMs =
        call.timeoutMs === undefined
          ? defaultTimeout
          : checkTimeout('timeoutMs', call.timeoutMs);
      const send = clientFor(timeoutMs)[name] as (
        input?: unknown,
      ) => Promise<unknown>;
      try {
        return await send(input);
      } catch (error) {
        throw toServerError(error, name, timeoutMs);
      }
    };
    return [name, method] as const;
  });
  return Object.fromEntries(methods) as unknown as ServerClient;
}
