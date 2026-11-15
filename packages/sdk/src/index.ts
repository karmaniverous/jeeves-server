/**
 * Typed TypeScript client for the jeeves-server HTTP API, built from the server's endpoint catalog (`SERVER_CATALOG`). Start with {@link createServerClient}; every failure is a {@link ServerError}. Browser-safe: imports only `@karmaniverous/jeeves/catalog` and `@karmaniverous/jeeves-server-core/catalog`.
 *
 * @packageDocumentation
 */

export type { FetchLike, ServerAuth, ShareCredential } from './auth.js';
export {
  type CallOptions,
  createServerClient,
  type ServerClient,
} from './createServerClient.js';
export {
  type ExportFormat,
  toExportUrl,
  toRawUrl,
  withShareCredential,
} from './links.js';
export {
  DEFAULT_TIMEOUT_MS,
  EXPORT_TIMEOUT_MS,
  type ServerClientOptions,
} from './options.js';
export {
  isServerError,
  type ServerClientErrorCode,
  ServerError,
  type ServerErrorCodeValue,
  type ServerErrorInit,
} from './ServerError.js';

// The server's error codes and their statuses.
export {
  SERVER_ERROR_CODES,
  SERVER_ERROR_STATUS,
  type ServerErrorCode,
} from '@karmaniverous/jeeves-server-core/catalog';

// Request and response types, inferred from the catalog.
export type {
  ServerEntryName,
  ServerHealth,
  ServerInput,
  ServerResponse,
} from '@karmaniverous/jeeves-server-core/catalog';
