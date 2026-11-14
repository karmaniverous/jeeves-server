/**
 * jeeves-server-core's main entry: the endpoint catalog with its schemas and error codes (also on the browser-safe `./catalog` sub-path), the OpenAPI document, the config schema, URL-key helpers and the Node-only link-key functions.
 *
 * @packageDocumentation
 */

export * from './catalog/index.js';
export {
  absolutePathSchema,
  isAbsolutePath,
  PRINT_PAPER_FORMATS,
  PRINT_STYLE_NAME,
  type PrintPageConfig,
  printPageSchema,
  type PrintStyleConfig,
  printStyleSchema,
  printStylesSchema,
} from './configPrintStyles.js';
export {
  computeDeepShareKey,
  computeInsiderKey,
  computeOutsiderKeyWithExpiry,
  computePathKey,
  type DeepShareParams,
  timingSafeEqual,
} from './crypto.js';
export { SERVER_OPENAPI_DOCUMENT } from './openapi.js';
export {
  type AuthMode,
  authModeSchema,
  authSchema,
  type Branding,
  brandingSchema,
  DEFAULT_BRANDING,
  DEPRECATED_CONFIG_PROPS,
  emailAuthSchema,
  eventConfigSchema,
  googleAuthSchema,
  insiderEntrySchema,
  isScopeName,
  type JeevesConfig,
  jeevesConfigSchema,
  keyEntrySchema,
  type LoggingConfig,
  loggingConfigSchema,
  oauthProviderSchema,
  oauthSchema,
  scopesObjectSchema,
  scopesSchema,
  themeOverridesSchema,
} from './schema.js';
export type {
  AuthStatusResponse,
  DriveEntry,
  ExportCacheClearResponse,
  ExportLink,
  FileMutationAction,
  LinkInfoResponse,
  OAuthStartRequest,
  OAuthStartResponse,
  RotateKeyResponse,
  ShareForRequest,
  ShareForResponse,
  ShareRequest,
  ShareResponse,
} from './types.js';
export { getUrlKey, LEGACY_URL_KEY_PARAM, URL_KEY_PARAM } from './urlKey.js';
