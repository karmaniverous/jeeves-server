/**
 * The runner proxy entries of the server catalog (Decision 28): the fixed set of jeeves-runner routes the server forwards (the 3.15.0 set, with enable and disable as `PATCH`), each with a fixed path and an opaque response so the runner's answers aren't re-described and strict response validation passes whatever the runner returns. Any other `/api/runner/*` path is no entry, so the server answers it 404 and never forwards it. Pure.
 *
 * @packageDocumentation
 */

import { z } from 'zod';

import { INSIDER_ONLY, route } from './route.js';

/** `:id`: the runner job; never `.`, `..`, a slash or a control character, so its runner path stays `/jobs/<id>`. */
const jobParams = z.object({
  id: z
    .string()
    .regex(/^(?!\.{1,2}$)[^/\\\p{Cc}]+$/u)
    .describe(
      'Runner job ID: not `.` or `..`, no `/` or `\\`, and no control characters.',
    ),
});

/** Query of the job runs entry. */
const runsQuery = z.object({
  limit: z.string().optional().describe('Maximum number of runs (default 20).'),
});

/** Whatever the runner answers. */
const runnerResponse = z.unknown();

/** Fields every runner entry shares. */
const RUNNER = { response: runnerResponse, auth: INSIDER_ONLY } as const;

/** The runner proxy entries. */
export const RUNNER_ENTRIES = [
  {
    ...route('runnerListJobs', 'GET', '/api/runner/jobs'),
    ...RUNNER,
    kind: 'read',
  },
  {
    ...route('runnerGetJob', 'GET', '/api/runner/jobs/:id'),
    params: jobParams,
    ...RUNNER,
    kind: 'read',
  },
  {
    ...route('runnerListRuns', 'GET', '/api/runner/jobs/:id/runs'),
    params: jobParams,
    query: runsQuery,
    ...RUNNER,
    kind: 'read',
  },
  {
    ...route('runnerRunJob', 'POST', '/api/runner/jobs/:id/run'),
    params: jobParams,
    ...RUNNER,
    kind: 'write',
  },
  {
    ...route('runnerEnableJob', 'PATCH', '/api/runner/jobs/:id/enable'),
    params: jobParams,
    ...RUNNER,
    kind: 'write',
  },
  {
    ...route('runnerDisableJob', 'PATCH', '/api/runner/jobs/:id/disable'),
    params: jobParams,
    ...RUNNER,
    kind: 'write',
  },
  {
    ...route('runnerStatus', 'GET', '/api/runner/status'),
    ...RUNNER,
    kind: 'read',
  },
] as const;
