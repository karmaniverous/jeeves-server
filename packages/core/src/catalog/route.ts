/**
 * Shared parts of the jeeves-server catalog entries: the `route` helper (name, method, path, description), the auth specs of the access classes, the `*` path params and the share-credential query (`shareQuerySchema`). Pure.
 *
 * @remarks
 * Auth specs are descriptive (jeeves spec Decision 80): the service's access
 * hook enforces the access model. Identity and share credentials travel as
 * the `k` query parameter or the `jeeves_session` cookie; the key-exchange
 * routes take the raw machine seed in `X-API-Key`.
 *
 * @packageDocumentation
 */

import type { AuthSpec } from '@karmaniverous/jeeves/catalog';
import { z } from 'zod';

import { ENTRY_DESCRIPTIONS } from './descriptions.js';

/** The server's own entry names (other than the three standard ones). */
export type ServerRouteName = keyof typeof ENTRY_DESCRIPTIONS;

/**
 * Name, method, path and description of a server entry.
 *
 * @param name - Entry name (also the SDK method, the plugin tool's base name
 *   and the OpenAPI `operationId`).
 * @param method - HTTP method.
 * @param path - Route path (Fastify syntax).
 * @returns The entry's identity fields.
 */
export function route<
  const N extends ServerRouteName,
  const M extends 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT',
  const P extends string,
>(name: N, method: M, path: P) {
  return {
    name,
    method,
    path,
    description: ENTRY_DESCRIPTIONS[name],
  } as const;
}

/** The URL key (`k`): an insider, machine or share key. */
const URL_KEY = { in: 'query', name: 'k' } as const;

/** The browser session cookie. */
const SESSION_COOKIE = { in: 'cookie', name: 'jeeves_session' } as const;

/**
 * `navigation` and `content` entries: an identity (session or insider key)
 * or a share credential.
 */
export const KEY_OR_SESSION = {
  schemes: [URL_KEY, SESSION_COOKIE],
} as const satisfies AuthSpec;

/**
 * `insider`, `admin` and `content + insider` entries: an identity only
 * (the service narrows `admin` to identities with no scopes).
 */
export const INSIDER_ONLY = {
  schemes: [URL_KEY, SESSION_COOKIE],
  insiderOnly: true,
} as const satisfies AuthSpec;

/** `machineSeed` entries: the raw machine seed in `X-API-Key`. */
export const MACHINE_SEED = {
  schemes: [{ in: 'header', name: 'X-API-Key' }],
} as const satisfies AuthSpec;

/** `eventKey` entries: a machine key valid for `/event`, as `k`. */
export const EVENT_KEY = { schemes: [URL_KEY] } as const satisfies AuthSpec;

/** `public` entries. */
export const PUBLIC = 'none' as const satisfies AuthSpec;

/**
 * Share-link parameters other than `k`, accepted by every content and
 * navigation entry (and read by `authStatus`): an expiry, the deep-share
 * fields and the legacy key parameter. All optional strings.
 */
export const shareQuerySchema = z.object({
  /** Expiry (Unix ms) of an expiring share key. */
  exp: z
    .string()
    .optional()
    .describe('Share link expiry (Unix milliseconds), for expiring keys.'),
  /** Deep share depth. */
  d: z.string().optional().describe('Deep share depth.'),
  /** Deep share: `1` when directories may be listed. */
  dirs: z
    .string()
    .optional()
    .describe('Deep share: 1 when directories below the shared path open.'),
  /** Deep share stack (compressed). */
  s: z.string().optional().describe('Deep share path stack.'),
  /** Legacy name of `k`. */
  key: z.string().optional().describe('Legacy name of the k parameter.'),
});

/**
 * The `*` path parameter: a browse path (`<root>/<path>`).
 *
 * @param description - What the path addresses.
 * @returns The params schema.
 */
export const wildcardParams = (description: string) =>
  z.object({ '*': z.string().describe(description) });

/** `*` of the content entries that address a file or a directory. */
export const browsePathParams = wildcardParams(
  'Browse path (e.g. "<drive>/path/to/file.md")',
);
