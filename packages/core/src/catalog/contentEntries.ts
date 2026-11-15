/**
 * The content entries of the server catalog: drives, browse, file content, write and mutate, raw, exports, export cache clear, link info, diagrams and public content. Content and navigation entries take the share parameters (`shareQuerySchema`) in their query. Pure.
 *
 * @packageDocumentation
 */

import { z } from 'zod';

import {
  browseResponseSchema,
  drivesResponseSchema,
  exportCacheClearResponseSchema,
  fileContentQuerySchema,
  fileContentResponseSchema,
  fileWriteBodySchema,
  fileWriteResponseSchema,
  linkInfoResponseSchema,
  okResponseSchema,
} from './contentSchemas.js';
import { fileMutateBodySchema } from './fileMutateSchema.js';
import {
  browsePathParams,
  INSIDER_ONLY,
  KEY_OR_SESSION,
  PUBLIC,
  route,
  shareQuerySchema,
  wildcardParams,
} from './route.js';

/** Bytes: the response of a binary entry. */
const bytes = z.instanceof(Uint8Array);

/** Content type of binary entries whose type depends on the file. */
const OCTET_STREAM = 'application/octet-stream';

/** An optional `format` query field. */
const formatQuery = (description: string) =>
  z.string().optional().describe(description);

/** The content entries. */
export const CONTENT_ENTRIES = [
  {
    ...route('drives', 'GET', '/api/drives'),
    query: shareQuerySchema,
    response: drivesResponseSchema,
    auth: KEY_OR_SESSION,
    kind: 'read',
  },
  {
    ...route('browse', 'GET', '/api/path/*'),
    params: wildcardParams('Browse path (e.g. "<drive>/path/to/dir")'),
    query: shareQuerySchema,
    response: browseResponseSchema,
    auth: KEY_OR_SESSION,
    kind: 'read',
  },
  {
    ...route('fileContent', 'GET', '/api/file/*'),
    params: browsePathParams,
    query: shareQuerySchema.extend(fileContentQuerySchema.shape),
    response: fileContentResponseSchema,
    auth: KEY_OR_SESSION,
    kind: 'read',
  },
  {
    ...route('fileWrite', 'PUT', '/api/file/*'),
    params: browsePathParams,
    query: shareQuerySchema,
    body: fileWriteBodySchema,
    response: fileWriteResponseSchema,
    auth: INSIDER_ONLY,
    kind: 'write',
  },
  {
    ...route('fileMutate', 'POST', '/api/file/*'),
    params: wildcardParams('File path (must be a .md file)'),
    query: shareQuerySchema,
    body: fileMutateBodySchema,
    response: okResponseSchema,
    auth: INSIDER_ONLY,
    kind: 'write',
  },
  {
    ...route('raw', 'GET', '/api/raw/*'),
    params: browsePathParams,
    query: shareQuerySchema.extend({
      download: z
        .string()
        .optional()
        .describe(
          '1 (or true): send Content-Disposition: attachment for any file type.',
        ),
    }),
    response: bytes,
    contentType: OCTET_STREAM,
    auth: KEY_OR_SESSION,
    kind: 'read',
  },
  {
    ...route('export', 'GET', '/api/export/*'),
    params: browsePathParams,
    query: shareQuerySchema.extend({
      format: z
        .enum(['pdf', 'docx', 'zip', 'tar'])
        .optional()
        .describe(
          'pdf (default) or docx for Markdown documents; zip or tar for directories.',
        ),
    }),
    response: bytes,
    contentType: OCTET_STREAM,
    auth: KEY_OR_SESSION,
    kind: 'read',
  },
  {
    ...route('exportCacheClear', 'DELETE', '/api/export-cache/*'),
    params: wildcardParams('Browse path to clear caches for'),
    query: shareQuerySchema,
    response: exportCacheClearResponseSchema,
    auth: INSIDER_ONLY,
    kind: 'write',
  },
  {
    ...route('exportMermaid', 'GET', '/api/mermaid-export/*'),
    params: browsePathParams,
    query: shareQuerySchema.extend({
      format: formatQuery('svg (default), png or pdf.'),
    }),
    response: bytes,
    contentType: OCTET_STREAM,
    auth: KEY_OR_SESSION,
    kind: 'read',
  },
  {
    ...route('exportPlantUml', 'GET', '/api/plantuml-export/*'),
    params: browsePathParams,
    query: shareQuerySchema.extend({
      format: formatQuery(
        'svg (default), or another format the renderers support (png, pdf, eps).',
      ),
    }),
    response: bytes,
    contentType: OCTET_STREAM,
    auth: KEY_OR_SESSION,
    kind: 'read',
  },
  {
    ...route('linkInfo', 'GET', '/api/link-info/*'),
    params: browsePathParams,
    query: shareQuerySchema,
    response: linkInfoResponseSchema,
    auth: KEY_OR_SESSION,
    kind: 'read',
  },
  {
    ...route('diagram', 'GET', '/api/diagram/:type/:hash'),
    params: z.object({
      type: z.enum(['mermaid', 'plantuml']).describe('Diagram type.'),
      hash: z
        .string()
        .describe('SHA-256 of the diagram source (hex), optionally with .svg.'),
    }),
    response: bytes,
    contentType: 'image/svg+xml',
    auth: PUBLIC,
    kind: 'read',
  },
  {
    ...route('publicContent', 'GET', '/api/public-content/:slug'),
    params: z.object({
      slug: z.string().describe('Page: readme, privacy or terms.'),
    }),
    response: fileContentResponseSchema,
    auth: PUBLIC,
    kind: 'read',
  },
] as const;
