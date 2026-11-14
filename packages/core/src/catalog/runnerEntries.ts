/**
 * The runner proxy entries of the server catalog: one entry per method on `/api/runner/*`, with an opaque body and response so the runner's API isn't re-described and strict response validation passes whatever the runner returns. Pure.
 *
 * @packageDocumentation
 */

import { z } from 'zod';

import { INSIDER_ONLY, route, wildcardParams } from './route.js';

/** `*`: the runner API path (e.g. `jobs/alpha/runs`). */
const runnerPath = wildcardParams('Runner API path (e.g. "jobs/alpha/runs").');

/** Query passed through to the runner (e.g. `limit`). */
const passThroughQuery = z.looseObject({});

/** Body passed through to the runner. */
const passThroughBody = z.looseObject({});

/** Whatever the runner answers. */
const runnerResponse = z.unknown();

/** The runner proxy entries. */
export const RUNNER_ENTRIES = [
  {
    ...route('runnerGet', 'GET', '/api/runner/*'),
    params: runnerPath,
    query: passThroughQuery,
    response: runnerResponse,
    auth: INSIDER_ONLY,
    kind: 'read',
  },
  {
    ...route('runnerPost', 'POST', '/api/runner/*'),
    params: runnerPath,
    query: passThroughQuery,
    body: passThroughBody,
    response: runnerResponse,
    auth: INSIDER_ONLY,
    kind: 'write',
  },
  {
    ...route('runnerPatch', 'PATCH', '/api/runner/*'),
    params: runnerPath,
    query: passThroughQuery,
    body: passThroughBody,
    response: runnerResponse,
    auth: INSIDER_ONLY,
    kind: 'write',
  },
  {
    ...route('runnerPut', 'PUT', '/api/runner/*'),
    params: runnerPath,
    query: passThroughQuery,
    body: passThroughBody,
    response: runnerResponse,
    auth: INSIDER_ONLY,
    kind: 'write',
  },
  {
    ...route('runnerDelete', 'DELETE', '/api/runner/*'),
    params: runnerPath,
    query: passThroughQuery,
    response: runnerResponse,
    auth: INSIDER_ONLY,
    kind: 'destructive',
  },
] as const;
