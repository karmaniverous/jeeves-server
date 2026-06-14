/**
 * Shared utilities and types for jeeves-server packages.
 *
 * @packageDocumentation
 */

export {
  computeDeepShareKey,
  computeInsiderKey,
  computeOutsiderKeyWithExpiry,
  computePathKey,
  type DeepShareParams,
  timingSafeEqual,
} from './crypto.js';
export { type EndpointEntry, serverEndpoints } from './endpoints.js';
export {
  type AuthMode,
  authModeSchema,
  authSchema,
  type Branding,
  brandingSchema,
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
