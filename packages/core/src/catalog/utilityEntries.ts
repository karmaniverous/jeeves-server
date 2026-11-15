/**
 * The utility entries of the server catalog: the liveness probe, auth status and magic link, the machine-key exchange routes and search. Pure.
 *
 * @packageDocumentation
 */

import { z } from 'zod';

import { INSIDER_ONLY, MACHINE_SEED, PUBLIC, route } from './route.js';
import {
  authStatusQuerySchema,
  authStatusResponseSchema,
  healthResponseSchema,
  insiderKeyResponseSchema,
  pathKeyResponseSchema,
  searchBodySchema,
  searchResponseSchema,
  sendMagicLinkBodySchema,
  sendMagicLinkResponseSchema,
} from './utilitySchemas.js';

/** The utility entries. */
export const UTILITY_ENTRIES = [
  {
    ...route('health', 'GET', '/health'),
    response: healthResponseSchema,
    auth: PUBLIC,
    kind: 'read',
  },
  {
    ...route('authStatus', 'GET', '/api/auth/status'),
    query: authStatusQuerySchema,
    response: authStatusResponseSchema,
    auth: PUBLIC,
    kind: 'read',
  },
  {
    ...route('sendMagicLink', 'POST', '/api/auth/magic'),
    body: sendMagicLinkBodySchema,
    response: sendMagicLinkResponseSchema,
    auth: PUBLIC,
    kind: 'write',
  },
  {
    ...route('pathKey', 'GET', '/key'),
    query: z.object({
      path: z.string().describe('Path to compute the outsider key for.'),
    }),
    response: pathKeyResponseSchema,
    auth: MACHINE_SEED,
    kind: 'read',
  },
  {
    ...route('insiderKey', 'GET', '/insider-key'),
    response: insiderKeyResponseSchema,
    auth: MACHINE_SEED,
    kind: 'read',
  },
  {
    ...route('search', 'POST', '/api/search'),
    body: searchBodySchema,
    response: searchResponseSchema,
    auth: INSIDER_ONLY,
    kind: 'read',
  },
  {
    ...route('searchFacets', 'GET', '/api/search/facets'),
    response: z.unknown(),
    auth: INSIDER_ONLY,
    kind: 'read',
  },
] as const;
