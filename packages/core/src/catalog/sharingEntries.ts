/**
 * The sharing entries of the server catalog: share, shareFor, contentLink, readmeLink, resolvePath and rotateKey, with their request and response schemas. Pure.
 *
 * @packageDocumentation
 */

import { z } from 'zod';

import { INSIDER_ONLY, PUBLIC, route } from './route.js';

/** `share` body. */
export const shareBodySchema = z.object({
  /** Path to share (`/<root>/<path>`). */
  path: z.string().describe('Path to share (/<root>/<path>).'),
  /** Expiry (Unix ms, as a string); omit for a link that doesn't expire. */
  expiry: z
    .string()
    .optional()
    .describe('Expiry (Unix milliseconds); omit for no expiry.'),
  /** Deep share depth (levels of links the recipient may follow). */
  depth: z.number().int().optional().describe('Deep share depth.'),
  /** Deep share: directories below the path may be listed. */
  dirs: z
    .boolean()
    .optional()
    .describe('Deep share: directories below the path may be opened.'),
});

/** `share` response. */
export const shareResponseSchema = z.object({
  /** Share URL (server-relative). */
  url: z.string(),
  /** The shared path. */
  path: z.string(),
  /** Expiry as given, or null. */
  exp: z.string().nullable(),
  /** Deep share depth (0 for a path share). */
  depth: z.number(),
  /** Deep share `dirs`. */
  dirs: z.boolean(),
  /** Whether the path is a directory. */
  isDirectory: z.boolean(),
});

/** `shareFor` body. */
export const shareForBodySchema = z.object({
  /** Path to share (`/<root>/<path>`). */
  path: z.string().describe('Path to share (/<root>/<path>).'),
  /** Recipients: insider emails, or anyone else (an outsider). */
  insiders: z
    .array(z.string())
    .describe('Recipients: insider emails; anyone else is an outsider.'),
  /** Deep share depth. */
  depth: z.number().int().optional().describe('Deep share depth.'),
  /** Deep share `dirs`. */
  dirs: z
    .boolean()
    .optional()
    .describe('Deep share: directories below the path may be opened.'),
  /** `false`: sign even where the outsider policy denies (with a warning). */
  enforceOutsiderPolicy: z
    .boolean()
    .optional()
    .describe('false: sign even where the outsider policy denies.'),
});

/** `shareFor` response. */
export const shareForResponseSchema = z.object({
  /** The link (absolute when a public URL is configured), or null. */
  url: z.string().nullable(),
  /** What was produced. */
  type: z.enum(['insider', 'outsider-share', 'blocked', 'policy-denied']),
  /** Why no link was produced. */
  reason: z.string().optional(),
  /** Recipients without access to the path (`blocked`). */
  blocked: z.array(z.string()).optional(),
  /** Set when the outsider policy would have denied the link. */
  warning: z.string().optional(),
});

/** `{ url }`: a pre-computed share link. */
export const linkResponseSchema = z.object({
  /** Share URL (server-relative). */
  url: z.string(),
});

/** `resolvePath` response. */
export const resolvePathResponseSchema = z.object({
  /** Browse path (`<root>/<path>`). */
  browsePath: z.string(),
  /** Page URL (server-relative, encoded). */
  browseUrl: z.string(),
  /** Absolute page URL, when a public URL is configured. */
  publicUrl: z.string().optional(),
});

/** `rotateKey` response. */
export const rotateKeyResponseSchema = z.object({
  /** Always true. */
  ok: z.literal(true),
  /** When the new key was created (ISO). */
  keyCreatedAt: z.string(),
  /** What stopped working: the insider key and the insider's outsider links. */
  invalidates: z.array(z.enum(['insiderKey', 'outsiderLinks'])).optional(),
});

/** The sharing entries. */
export const SHARING_ENTRIES = [
  {
    ...route('share', 'POST', '/api/share'),
    body: shareBodySchema,
    response: shareResponseSchema,
    auth: INSIDER_ONLY,
    kind: 'read',
  },
  {
    ...route('shareFor', 'POST', '/api/util/share-for'),
    body: shareForBodySchema,
    response: shareForResponseSchema,
    auth: INSIDER_ONLY,
    kind: 'read',
  },
  {
    ...route('contentLink', 'GET', '/api/content-link/:file'),
    params: z.object({
      file: z.string().describe('Content page: privacy or terms.'),
    }),
    response: linkResponseSchema,
    auth: PUBLIC,
    kind: 'read',
  },
  {
    ...route('readmeLink', 'GET', '/api/readme-link'),
    response: linkResponseSchema,
    auth: PUBLIC,
    kind: 'read',
  },
  {
    ...route('resolvePath', 'GET', '/api/resolve-path'),
    query: z.object({
      fsPath: z.string().describe('Absolute filesystem path to resolve'),
    }),
    response: resolvePathResponseSchema,
    auth: INSIDER_ONLY,
    kind: 'read',
  },
  {
    ...route('rotateKey', 'POST', '/api/rotate-key'),
    response: rotateKeyResponseSchema,
    auth: INSIDER_ONLY,
    kind: 'destructive',
  },
] as const;
