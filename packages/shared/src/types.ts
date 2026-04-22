/**
 * Shared API request/response types between service and plugin.
 *
 * @packageDocumentation
 */

/** POST /api/share request body. */
export interface ShareRequest {
  path: string;
  expiry?: string;
  depth?: number;
  dirs?: boolean;
}

/** POST /api/share response. */
export interface ShareResponse {
  url: string;
  path: string;
  exp: string | null;
  depth: number;
  dirs: boolean;
}

/** POST /api/util/share-for request body. */
export interface ShareForRequest {
  path: string;
  insiders: string[];
  depth?: number;
  dirs?: boolean;
  enforceOutsiderPolicy?: boolean;
}

/** POST /api/util/share-for response. */
export interface ShareForResponse {
  url: string | null;
  type: 'insider' | 'outsider-share' | 'blocked' | 'policy-denied';
  reason?: string;
  blocked?: string[];
  warning?: string;
}

/** POST /api/oauth/start request body. */
export interface OAuthStartRequest {
  provider: string;
  account: string;
  clientId: string;
  clientSecret: string;
  scopes?: string[];
  origin?: string;
}

/** POST /api/oauth/start response. */
export interface OAuthStartResponse {
  authUrl?: string;
}

/** GET /api/link-info response. */
export interface LinkInfoResponse {
  exists: boolean;
  isDirectory?: boolean;
  pageUrl?: string;
  rawUrl?: string | null;
  exportLinks?: ExportLink[];
}

/** Export link entry in link-info response. */
export interface ExportLink {
  format: string;
  url: string;
}

/** GET /api/export-cache DELETE response. */
export interface ExportCacheClearResponse {
  cleared: {
    exports: number;
    diagrams: number;
  };
}

/** File mutation action types. */
export type FileMutationAction =
  | 'edit-block'
  | 'delete-block'
  | 'insert-block'
  | 'edit-cell'
  | 'toggle-checkbox';

/** POST /api/rotate-key response. */
export interface RotateKeyResponse {
  ok: boolean;
  keyCreatedAt: string;
}

/** GET /api/auth/status response. */
export interface AuthStatusResponse {
  authenticated: boolean;
  email?: string;
  picture?: string;
  isInsider: boolean;
  keyCreatedAt?: string | null;
  searchEnabled?: boolean;
}

/** GET /api/drives response entry. */
export interface DriveEntry {
  letter: string;
  label: string;
}
