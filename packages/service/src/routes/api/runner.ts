/**
 * Runner proxy (Decision 28): the fixed set of jeeves-runner routes the server forwards to the local runner (it listens on localhost only, so the server is its authenticated gateway). Insider-only. Each entry calls one runner route: method and path are fixed here, and only the job ID (encoded as one path segment) and the runs `limit` come from the request, never a credential or a body. The runner's status, body, `content-type` and `Retry-After` come back (#315). Any other `/api/runner/*` path is no catalog entry, so it is a 404 and never reaches the runner.
 *
 * @packageDocumentation
 */

import { getServiceUrl } from '@karmaniverous/jeeves';
import type { ErrorStatus, SuccessStatus } from '@karmaniverous/jeeves/fastify';
import type { FastifyRequest } from 'fastify';

import { InvalidRequest, RunnerUnavailable } from '../../api/errors.js';
import type { HandlersFor } from '../../api/handlerTypes.js';
import { requireInsider } from './scopeGuard.js';

/** Runs listed when the caller gives no `limit` (as in 3.15.0). */
const DEFAULT_RUNS_LIMIT = '20';

/**
 * A runner job's path.
 *
 * @param id - The job ID (decoded).
 * @returns `/jobs/<id>`, the ID encoded as one path segment.
 * @throws `SERVER_INVALID_REQUEST` when the ID is empty, `.` or `..`, or holds
 *   a `/`, a `\` or a control character (the catalog refuses these first;
 *   this is defence in depth, since the runner would read a dot segment as a step up its own paths).
 */
function jobPath(id: string): string {
  if (id === '' || id === '.' || id === '..' || /[/\\\p{Cc}]/u.test(id))
    throw new InvalidRequest('Invalid runner job ID');
  return `/jobs/${encodeURIComponent(id)}`;
}

/** The runner's body: JSON when it parses, else its text. */
function parseBody(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

/** The `{ code?, message }` of a runner error body. */
function errorBody(body: unknown, text: string) {
  if (typeof body === 'object' && body !== null) {
    const { code, message } = body as { code?: unknown; message?: unknown };
    return {
      ...(typeof code === 'string' ? { code } : {}),
      message: typeof message === 'string' ? message : text,
    };
  }
  return { message: text };
}

/**
 * Forward a request to one runner route and return its answer unchanged.
 *
 * @param method - The runner route's method.
 * @param path - The runner route's path (and query).
 * @param request - The request.
 * @returns The runner's status, body and headers.
 * @throws `SERVER_INSIDER_REQUIRED` without insider access,
 *   `SERVER_RUNNER_UNAVAILABLE` (503) when the runner can't be reached (the
 *   transport error is its `cause`, logged, never sent).
 */
async function proxyToRunner(
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  request: FastifyRequest,
) {
  requireInsider(request);
  let res: Response;
  let text: string;
  try {
    res = await fetch(`${getServiceUrl('runner')}${path}`, { method });
    text = await res.text();
  } catch (cause) {
    throw Object.assign(new RunnerUnavailable(), { cause });
  }
  const retryAfter = res.headers.get('retry-after');
  const headers = {
    'content-type': res.headers.get('content-type') ?? 'application/json',
    ...(retryAfter === null ? {} : { 'retry-after': retryAfter }),
  };
  const parsed = parseBody(text);
  return res.status >= 400
    ? {
        status: res.status as ErrorStatus,
        body: errorBody(parsed, text),
        headers,
      }
    : { status: res.status as SuccessStatus, body: parsed, headers };
}

/** The runner proxy handlers: the only runner routes the server forwards. */
export const runnerHandlers: HandlersFor<
  | 'runnerListJobs'
  | 'runnerGetJob'
  | 'runnerListRuns'
  | 'runnerRunJob'
  | 'runnerEnableJob'
  | 'runnerDisableJob'
  | 'runnerStatus'
> = {
  runnerListJobs: (_input, request) => proxyToRunner('GET', '/jobs', request),
  runnerGetJob: ({ params }, request) =>
    proxyToRunner('GET', jobPath(params.id), request),
  runnerListRuns: ({ params, query }, request) => {
    const search = new URLSearchParams({
      limit: query.limit ?? DEFAULT_RUNS_LIMIT,
    });
    return proxyToRunner(
      'GET',
      `${jobPath(params.id)}/runs?${search.toString()}`,
      request,
    );
  },
  runnerRunJob: ({ params }, request) =>
    proxyToRunner('POST', `${jobPath(params.id)}/run`, request),
  runnerEnableJob: ({ params }, request) =>
    proxyToRunner('PATCH', `${jobPath(params.id)}/enable`, request),
  runnerDisableJob: ({ params }, request) =>
    proxyToRunner('PATCH', `${jobPath(params.id)}/disable`, request),
  runnerStatus: (_input, request) => proxyToRunner('GET', '/status', request),
};
