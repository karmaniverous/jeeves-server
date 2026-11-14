/**
 * Browser-safe entry point of jeeves-server-core (`@karmaniverous/jeeves-server-core/catalog`): the endpoint catalog, its request and response schemas and the error codes. Imports only `zod` and `@karmaniverous/jeeves/catalog`, never Node built-ins, so the SDK and the web client can bundle it.
 *
 * @packageDocumentation
 */

export {
  SERVER_ERROR_CODES,
  SERVER_ERROR_STATUS,
  type ServerErrorCode,
} from '../errors.js';
export {
  breadcrumbSchema,
  browseResponseSchema,
  directoryEntrySchema,
  directoryListingSchema,
  driveSchema,
  drivesResponseSchema,
  exportCacheClearResponseSchema,
  exportLinkSchema,
  fileContentQuerySchema,
  fileContentResponseSchema,
  fileMetadataSchema,
  fileWriteBodySchema,
  fileWriteResponseSchema,
  headingSchema,
  linkInfoResponseSchema,
  okResponseSchema,
} from './contentSchemas.js';
export {
  eventLogEntrySchema,
  receiveEventResponseSchema,
} from './eventEntries.js';
export {
  FILE_MUTATION_ACTIONS,
  FILE_MUTATION_REQUIRED_FIELDS,
  type FileMutateBody,
  fileMutateBodySchema,
} from './fileMutateSchema.js';
export {
  oauthCredentialQuerySchema,
  oauthStartBodySchema,
  oauthStartResponseSchema,
  oauthStatusResponseSchema,
  oauthTokenResponseSchema,
} from './oauthEntries.js';
export { shareQuerySchema } from './route.js';
export {
  SERVER_CATALOG,
  type ServerCatalog,
  type ServerEntry,
  type ServerEntryName,
  type ServerHealth,
  type ServerInput,
  type ServerResponse,
} from './serverCatalog.js';
export {
  linkResponseSchema,
  resolvePathResponseSchema,
  rotateKeyResponseSchema,
  shareBodySchema,
  shareForBodySchema,
  shareForResponseSchema,
  shareResponseSchema,
} from './sharingEntries.js';
export {
  eventQueueHealthSchema,
  serverHealthSchema,
  serviceProbeSchema,
} from './statusSchemas.js';
export {
  authStatusQuerySchema,
  authStatusResponseSchema,
  healthResponseSchema,
  insiderKeyResponseSchema,
  pathKeyResponseSchema,
  searchBodySchema,
  searchResponseSchema,
  searchResultSchema,
  sendMagicLinkBodySchema,
  sendMagicLinkResponseSchema,
} from './utilitySchemas.js';
