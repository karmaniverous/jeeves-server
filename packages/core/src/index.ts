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
export {
  authModeSchema,
  authSchema,
  DEPRECATED_CONFIG_PROPS,
  eventConfigSchema,
  googleAuthSchema,
  insiderEntrySchema,
  isScopeName,
  jeevesConfigSchema,
  keyEntrySchema,
  oauthProviderSchema,
  oauthSchema,
  scopesObjectSchema,
  scopesSchema,
  type AuthMode,
  type JeevesConfig,
} from './schema.js';
