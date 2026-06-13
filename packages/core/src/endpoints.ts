/**
 * Declarative endpoint catalog — single source of truth for the jeeves-server
 * API surface. Consumers (CLI, OpenClaw plugin) derive their registrations
 * from this catalog.
 *
 * @packageDocumentation
 */

import type { z } from 'zod';

/**
 * Describes a single API operation.
 */
export interface EndpointEntry {
  /** HTTP method. */
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  /** URL path pattern (Fastify-style, e.g. '/api/file/*'). */
  path: string;
  /** Human-readable operation description. */
  description: string;
  /** Zod schema for query params (GET) or request body (POST/PUT). */
  params?: z.ZodType;
  /** Zod schema for the response body. */
  response?: z.ZodType;
  /** Whether the endpoint requires insider auth. */
  insiderOnly?: boolean;
  /** Whether the endpoint is unauthenticated. */
  unauthenticated?: boolean;
}

/**
 * Complete API endpoint catalog for jeeves-server.
 *
 * Keys are stable operation identifiers used by consumers to reference
 * specific endpoints. Values describe the HTTP operation.
 */
export const serverEndpoints: Record<string, EndpointEntry> = {
  // --- Status & Config ---
  status: {
    method: 'GET',
    path: '/status',
    description:
      'Server health: name, version, uptime, status, health details.',
    unauthenticated: true,
  },
  config: {
    method: 'GET',
    path: '/config',
    description: 'Query running config with optional JSONPath filter (?path=).',
    unauthenticated: true,
  },
  'config-apply': {
    method: 'POST',
    path: '/config/apply',
    description:
      'Push config patch to running service (deep-merge + validate + reload).',
    insiderOnly: true,
  },

  // --- Authentication ---
  'auth-status': {
    method: 'GET',
    path: '/api/auth/status',
    description: 'Check current authentication status (no auth required).',
    unauthenticated: true,
  },
  'auth-login': {
    method: 'GET',
    path: '/auth/login',
    description: 'Redirect to Google OAuth consent screen.',
    unauthenticated: true,
  },
  'auth-callback': {
    method: 'GET',
    path: '/auth/callback',
    description: 'Handle Google OAuth callback, set session cookie.',
    unauthenticated: true,
  },
  'auth-logout': {
    method: 'GET',
    path: '/auth/logout',
    description: 'Clear session cookie.',
    unauthenticated: true,
  },

  // --- File Browser ---
  drives: {
    method: 'GET',
    path: '/api/drives',
    description: 'List available root drives/labels configured on the server.',
  },
  path: {
    method: 'GET',
    path: '/api/path/*',
    description: 'Get directory listing for a path.',
  },
  'file-get': {
    method: 'GET',
    path: '/api/file/*',
    description:
      'Get file content with type-specific handling (markdown, csv, diagrams, etc.).',
  },
  'file-put': {
    method: 'PUT',
    path: '/api/file/*',
    description:
      'Overwrite file content (insider-only; file must already exist).',
    insiderOnly: true,
  },
  'file-mutate': {
    method: 'POST',
    path: '/api/file/*',
    description:
      'Apply structured .md mutations: edit-block, delete-block, insert-block, edit-cell, toggle-checkbox.',
    insiderOnly: true,
  },
  raw: {
    method: 'GET',
    path: '/api/raw/*',
    description: 'Direct file download with appropriate content type.',
  },

  // --- Export ---
  export: {
    method: 'GET',
    path: '/api/export/*',
    description: 'Trigger export (PDF, DOCX, ZIP) and return download.',
  },
  'export-cache-clear': {
    method: 'DELETE',
    path: '/api/export-cache/*',
    description: 'Clear export and diagram caches for a given path.',
    insiderOnly: true,
  },
  'mermaid-export': {
    method: 'GET',
    path: '/api/mermaid-export/*',
    description: 'Export Mermaid diagram (svg, png, pdf).',
  },
  'plantuml-export': {
    method: 'GET',
    path: '/api/plantuml-export/*',
    description: 'Export PlantUML diagram (svg, png, pdf, eps).',
  },

  // --- Diagrams ---
  diagram: {
    method: 'GET',
    path: '/api/diagram/:type/:hash',
    description: 'Fetch rendered diagram by type and content hash.',
    unauthenticated: true,
  },

  // --- Sharing ---
  share: {
    method: 'POST',
    path: '/api/share',
    description: 'Generate HMAC-signed share link for a path.',
    insiderOnly: true,
  },
  'share-for': {
    method: 'POST',
    path: '/api/util/share-for',
    description:
      'Generate share link targeting specific insiders with configurable expiry/depth.',
    insiderOnly: true,
  },
  'readme-link': {
    method: 'GET',
    path: '/api/readme-link',
    description:
      'Pre-computed share link for the first README.md in the directory hierarchy.',
    unauthenticated: true,
  },
  'content-link': {
    method: 'GET',
    path: '/api/content-link/:file',
    description:
      'Pre-computed deep share URL for pinned content files (privacy, terms).',
    unauthenticated: true,
  },
  'link-info': {
    method: 'GET',
    path: '/api/link-info/*',
    description:
      'Query available link types for a path (page, raw, PDF, DOCX, etc.).',
  },
  'rotate-key': {
    method: 'POST',
    path: '/api/rotate-key',
    description:
      'Rotate the authenticated insider API key (invalidates all existing share links).',
    insiderOnly: true,
  },

  // --- Events ---
  event: {
    method: 'POST',
    path: '/event',
    description: 'Event gateway webhook receiver (scoped key auth).',
  },
  events: {
    method: 'GET',
    path: '/api/events',
    description: 'Query recent event log entries (limit capped at 100).',
  },

  // --- Search ---
  search: {
    method: 'POST',
    path: '/api/search',
    description: 'Semantic search (proxied to watcher).',
  },
  'search-facets': {
    method: 'GET',
    path: '/api/search/facets',
    description: 'Search facet metadata (proxied to watcher).',
  },

  // --- Runner ---
  runner: {
    method: 'GET',
    path: '/api/runner/*',
    description: 'Runner API proxy (proxied to jeeves-runner).',
  },

  // --- OAuth ---
  'oauth-start': {
    method: 'POST',
    path: '/api/oauth/start',
    description: 'Initiate OAuth2 authorization code flow.',
    insiderOnly: true,
  },
  'oauth-status': {
    method: 'GET',
    path: '/api/oauth/status',
    description:
      'Check if valid OAuth2 credentials exist for a provider/account.',
    insiderOnly: true,
  },
  'oauth-token': {
    method: 'GET',
    path: '/api/oauth/token',
    description: 'Retrieve valid access token (with lazy refresh).',
    insiderOnly: true,
  },
  'oauth-callback': {
    method: 'GET',
    path: '/oauth/callback',
    description: 'OAuth2 callback (browser redirect target, unauthenticated).',
    unauthenticated: true,
  },

  // --- Keys ---
  'insider-key': {
    method: 'GET',
    path: '/insider-key',
    description: 'Get insider key for the authenticated user.',
  },
  key: {
    method: 'GET',
    path: '/key',
    description: 'Compute path-specific key.',
  },
  'share-legacy': {
    method: 'GET',
    path: '/share',
    description: 'Generate outsider share link (top-level legacy route).',
  },

  // --- Shortlinks ---
  go: {
    method: 'GET',
    path: '/go/:slug',
    description: 'Shortlink redirect (unauthenticated).',
    unauthenticated: true,
  },
} as const;
