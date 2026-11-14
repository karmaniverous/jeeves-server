/**
 * Runner proxy: `/api/runner/*` passes through to the local jeeves-runner API (it listens on localhost only, so the server is its authenticated gateway). Insider-only. Method, path, query (credentials removed) and body go to the runner; its status, body, `content-type` and `Retry-After` come back (#315). The runner's API isn't re-described here.
 *
 * @packageDocumentation
 */

import { getServiceUrl } from '@karmaniverous/jeeves';
import type { ErrorStatus, SuccessStatus } from '@karmaniverous/jeeves/fastify';
import type { FastifyRequest } from 'fastify';

import { RunnerUnavailable } from '../../api/errors.js';
import type { HandlersFor } from '../../api/handlerTypes.js';
import { requireInsider } from './scopeGuard.js';

/** Methods whose body is forwarded (GET and DELETE carry none). */
const BODY_METHODS = new Set(['POST', 'PATCH', 'PUT']);

/** Query parameters that carry the caller's credential: never forwarded. */
const CREDENTIAL_PARAMS = new Set(['k', 'key']);

/** What a pass-through handler receives. */
interface RunnerInput {
  params: { '*': string };
  query: Record<string, unknown>;
  body?: Record<string, unknown>;
}

/**
 * The runner URL for a proxied request: the path's segments re-encoded,
 * the query without credentials.
 *
 * @param path - The runner API path (`*`, decoded).
 * @param query - The validated query.
 * @returns The runner path and query string.
 */
export function runnerTarget(
  path: string,
  query: Record<string, unknown>,
): string {
  const search = new URLSearchParams();
  for (const [name, value] of Object.entries(query)) {
    if (CREDENTIAL_PARAMS.has(name)) continue;
    for (const item of Array.isArray(value) ? value : [value])
      if (item !== undefined) search.append(name, String(item));
  }
  const encoded = path.split('/').map(encodeURIComponent).join('/');
  const qs = search.toString();
  return `/${encoded}${qs ? `?${qs}` : ''}`;
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
 * Forward a request to the runner and return its answer unchanged.
 *
 * @param method - The HTTP method.
 * @param input - The validated request.
 * @param request - The request.
 * @returns The runner's status, body and headers.
 * @throws `SERVER_INSIDER_REQUIRED` without insider access,
 *   `SERVER_RUNNER_UNAVAILABLE` (503) when the runner can't be reached (the
 *   transport error is its `cause`, logged, never sent).
 */
async function proxyToRunner(
  method: string,
  { params, query, body }: RunnerInput,
  request: FastifyRequest,
) {
  requireInsider(request);
  let res: Response;
  let text: string;
  try {
    res = await fetch(
      `${getServiceUrl('runner')}${runnerTarget(params['*'], query)}`,
      {
        method,
        ...(!BODY_METHODS.has(method) || body === undefined
          ? {}
          : {
              body: JSON.stringify(body),
              headers: { 'content-type': 'application/json' },
            }),
      },
    );
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

/** The runner pass-through handlers, one per method. */
export const runnerHandlers: HandlersFor<
  'runnerGet' | 'runnerPost' | 'runnerPatch' | 'runnerPut' | 'runnerDelete'
> = {
  runnerGet: (input, request) => proxyToRunner('GET', input, request),
  runnerPost: (input, request) => proxyToRunner('POST', input, request),
  runnerPatch: (input, request) => proxyToRunner('PATCH', input, request),
  runnerPut: (input, request) => proxyToRunner('PUT', input, request),
  runnerDelete: (input, request) => proxyToRunner('DELETE', input, request),
};
