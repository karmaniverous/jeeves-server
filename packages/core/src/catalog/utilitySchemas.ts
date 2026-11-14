/**
 * Request and response schemas of the utility entries: health, auth status, magic link, the key-exchange routes and search, describing what the service's handlers send. Pure.
 *
 * @packageDocumentation
 */

import { z } from 'zod';

import { shareQuerySchema } from './route.js';

/** `health` response. */
export const healthResponseSchema = z.object({
  /** Always true. */
  ok: z.literal(true),
});

/**
 * `authStatus` query: the share parameters (a share credential is resolved
 * like any other) and the path it is checked against.
 */
export const authStatusQuerySchema = shareQuerySchema.extend({
  /** Path a share credential is verified against (default `/`). */
  path: z
    .string()
    .optional()
    .describe('Path a share credential is verified against (default /).'),
});

/** `authStatus` response. */
export const authStatusResponseSchema = z.object({
  /** Whether a credential was recognised. */
  authenticated: z.boolean(),
  /** Session email, or `key:<name>` for a key. */
  email: z.string().optional(),
  /** Profile picture URL of a Google session. */
  picture: z.string().optional(),
  /** Whether the caller is an insider. */
  isInsider: z.boolean(),
  /** When the insider's key was last rotated (ISO), or null. */
  keyCreatedAt: z.string().nullable().optional(),
  /** Sessions only: search is available. */
  searchEnabled: z.boolean().optional(),
});

/** `sendMagicLink` body. */
export const sendMagicLinkBodySchema = z.object({
  /** Email to send the link to. */
  email: z.string().optional().describe('Email address to sign in with.'),
  /** Page to open after sign-in (server-relative). */
  returnTo: z
    .string()
    .optional()
    .describe('Page to open after sign-in (server-relative).'),
});

/** `sendMagicLink` response. */
export const sendMagicLinkResponseSchema = z.object({
  /** Page where the emailed code is entered (same for every email). */
  verifyUrl: z.string(),
});

/** `pathKey` response. */
export const pathKeyResponseSchema = z.object({
  /** The path asked for. */
  path: z.string(),
  /** Its outsider path key. */
  key: z.string(),
});

/** `insiderKey` response. */
export const insiderKeyResponseSchema = z.object({
  /** The insider key of the machine seed. */
  key: z.string(),
});

/** `search` body. */
export const searchBodySchema = z.object({
  /** Search text. */
  query: z.string().describe('Search text.'),
  /** Files to return (default 20). */
  limit: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Files to return (default 20).'),
  /** Qdrant filter, passed to jeeves-watcher. */
  filter: z
    .record(z.string(), z.unknown())
    .optional()
    .describe('Qdrant filter, passed to jeeves-watcher.'),
});

/** One file of the search results, with its matching chunks. */
export const searchResultSchema = z.object({
  /** Filesystem path the watcher indexed. */
  filePath: z.string(),
  /** Browse path. */
  browsePath: z.string(),
  /** File name. */
  fileName: z.string(),
  /** Best chunk score. */
  bestScore: z.number(),
  /** Domains from the index metadata. */
  domains: z.array(z.unknown()),
  /** `title` from the index metadata. */
  title: z.unknown().optional(),
  /** `author` from the index metadata. */
  author: z.unknown().optional(),
  /** `participants` from the index metadata. */
  participants: z.unknown().optional(),
  /** Other index metadata. */
  metadata: z.record(z.string(), z.unknown()),
  /** Matching chunks, in document order. */
  chunks: z.array(
    z.object({
      /** Chunk text. */
      text: z.string(),
      /** Chunk index. */
      index: z.number(),
      /** Chunk score. */
      score: z.number(),
    }),
  ),
  /** File modification time (ISO), when readable. */
  mtime: z.string().optional(),
});

/** `search` response. */
export const searchResponseSchema = z.object({
  /** Files, best first. */
  results: z.array(searchResultSchema),
  /** Distinct values across the results, for filter chips. */
  metadata: z.object({
    /** Distinct domains. */
    domains: z.array(z.unknown()),
    /** Distinct authors. */
    authors: z.array(z.unknown()),
    /** Distinct participants. */
    participants: z.array(z.unknown()),
  }),
});
