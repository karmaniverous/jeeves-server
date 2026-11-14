/**
 * Response and request schemas of the content entries (drives, browse, file content, write and mutate, link info, export cache clear, public content), describing what the service's handlers send. Pure.
 *
 * @remarks
 * Field order follows the handlers' output: with strict response
 * validation the service sends the parsed value, so a schema's key order is
 * the body's key order. Fields are plain strings (no formats) because they
 * carry paths, dates and names exactly as the handlers build them.
 *
 * @packageDocumentation
 */

import { z } from 'zod';

/** One breadcrumb of a file or directory view. */
export const breadcrumbSchema = z.object({
  /** Display label (a root's label or a path segment). */
  label: z.string(),
  /** Browse path of the crumb. */
  path: z.string(),
});

/** One `drives` row: a configured root. */
export const driveSchema = z.object({
  /** Root id, the first segment of every browse path below it. */
  letter: z.string(),
  /** Root label (its filesystem path, or the configured label). */
  label: z.string(),
});

/** `drives` response: the roots the caller may navigate into. */
export const drivesResponseSchema = z.array(driveSchema);

/** One entry of a directory listing. */
export const directoryEntrySchema = z.object({
  /** File or directory name. */
  name: z.string(),
  /** Entry type. */
  type: z.enum(['directory', 'file']),
  /** Lowercase extension with its dot, or empty. */
  ext: z.string(),
  /** File size in bytes; null for directories. */
  size: z.number().nullable(),
  /** Modification date (`YYYY-MM-DD`), or null when unreadable. */
  mtime: z.string().nullable(),
  /** Number of children of a directory; null for files. */
  itemCount: z.number().nullable(),
  /**
   * Deep-share listings only: the entry's own share URL, or null when it
   * may not be opened.
   */
  shareUrl: z.string().nullable().optional(),
});

/** `browse` response for a file: its metadata. */
export const fileMetadataSchema = z.object({
  /** Always `file`. */
  type: z.literal('file'),
  /** The browse path asked for. */
  path: z.string(),
  /** Lowercase extension with its dot, or empty. */
  ext: z.string(),
  /** Size in bytes. */
  size: z.number(),
  /** Modification date (`YYYY-MM-DD`). */
  mtime: z.string(),
});

/** `browse` response for a directory: its listing. */
export const directoryListingSchema = z.object({
  /** The browse path asked for. */
  path: z.string(),
  /** Entries the caller may see, directories first. */
  entries: z.array(directoryEntrySchema),
  /** Breadcrumbs (outsiders see only those inside their share). */
  breadcrumbs: z.array(breadcrumbSchema),
  /** Whether the caller is an insider. */
  isInsider: z.boolean(),
});

/** `browse` response: file metadata or a directory listing. */
export const browseResponseSchema = z.union([
  fileMetadataSchema,
  directoryListingSchema,
]);

/** One heading of a rendered Markdown document. */
export const headingSchema = z.object({
  /** Heading level (1-6). */
  level: z.number(),
  /** Heading text. */
  text: z.string(),
  /** Anchor slug. */
  slug: z.string(),
});

/**
 * `fileContent` response. One shape for every file type: `type` says which
 * fields are present.
 */
export const fileContentResponseSchema = z.object({
  /** How the file is shown. */
  type: z.enum([
    'markdown',
    'mermaid',
    'plantuml',
    'svg',
    'csv',
    'text',
    'image',
    'binary',
  ]),
  /** File text (Markdown, diagram, SVG, CSV and text files). */
  content: z.string().optional(),
  /** Rendered HTML; null when a diagram could not be rendered. */
  html: z.string().nullable().optional(),
  /** Heading outline of rendered Markdown. */
  headings: z.array(headingSchema).optional(),
  /** Size in bytes (binary files). */
  size: z.number().optional(),
  /** File name. */
  fileName: z.string(),
  /** Breadcrumbs (outsiders see only those inside their share). */
  breadcrumbs: z.array(breadcrumbSchema),
  /** Whether the caller is an insider. */
  isInsider: z.boolean(),
  /** Modification time (Unix ms) of rendered Markdown. */
  mtime: z.number().optional(),
  /** Format jeeves-watcher rendered the file as (watcher-rendered files). */
  renderAs: z.string().optional(),
  /** Watcher rules that matched (watcher-rendered files). */
  matchedRules: z.array(z.string()).optional(),
  /** Document title: front matter `title`, else the file name. */
  title: z.string().optional(),
});

/** `fileContent` query, beside the share parameters. */
export const fileContentQuerySchema = z.object({
  /** `1`: send the file text without rendering it. */
  raw: z
    .string()
    .optional()
    .describe('1: return the source without rendering it.'),
  /** `1`: render embedded diagrams into the HTML. */
  render_diagrams: z
    .string()
    .optional()
    .describe('1: render embedded diagrams into the HTML.'),
});

/** `fileWrite` body. */
export const fileWriteBodySchema = z.object({
  /** New file content. */
  content: z.string().describe('New file content'),
});

/** `fileWrite` response. */
export const fileWriteResponseSchema = z.object({
  /** Always true. */
  ok: z.literal(true),
  /** Filesystem path written. */
  path: z.string(),
  /** Bytes written (UTF-8). */
  size: z.number(),
});

/** `{ ok: true }`. */
export const okResponseSchema = z.object({
  /** Always true. */
  ok: z.literal(true),
});

/** One available export of a path. */
export const exportLinkSchema = z.object({
  /** Export format (`pdf`, `docx`, `zip`, `svg`, ...). */
  format: z.string(),
  /** Export URL (server-relative). */
  url: z.string(),
});

/** `linkInfo` response; only `exists` when the path doesn't exist. */
export const linkInfoResponseSchema = z.object({
  /** Whether the path exists. */
  exists: z.boolean(),
  /** Whether it is a directory. */
  isDirectory: z.boolean().optional(),
  /** Page URL (server-relative). */
  pageUrl: z.string().optional(),
  /** Raw file URL (server-relative); null for directories. */
  rawUrl: z.string().nullable().optional(),
  /** Raw URL that always downloads (`?download=1`); null for directories. */
  downloadUrl: z.string().nullable().optional(),
  /** Available exports. */
  exportLinks: z.array(exportLinkSchema).optional(),
});

/** `exportCacheClear` response. */
export const exportCacheClearResponseSchema = z.object({
  /** Entries removed. */
  cleared: z.object({
    /** Cached PDF/DOCX exports removed. */
    exports: z.number(),
    /** Cached diagram renders removed. */
    diagrams: z.number(),
  }),
});
