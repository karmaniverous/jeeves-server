/**
 * The mapping from jeeves' catalog-client errors to `ServerError`: responses keep status, code (else `http_<status>`), message and `Retry-After`; client-side failures get status 0 and the SDK's own codes.
 */

import { CatalogClientError } from '@karmaniverous/jeeves/catalog';
import { describe, expect, it } from 'vitest';

import { isServerError, ServerError } from './ServerError.js';
import { toServerError } from './toServerError.js';

const BODY = {
  statusCode: 403,
  code: 'SERVER_OUT_OF_SCOPE',
  error: 'Forbidden',
  message: 'Path is outside your scopes',
};

/** A catalog-client error for a response. */
const responseError = (
  status: number,
  body?: Partial<typeof BODY>,
  headers: Record<string, string> = {},
) =>
  new CatalogClientError('failed', {
    status,
    ...(body === undefined ? {} : { body: body as typeof BODY }),
    headers: new Headers(headers),
  });

/** The fields a caller branches on. */
const fields = (error: ServerError) => ({
  code: error.code,
  status: error.status,
  message: error.message,
  retryAfterMs: error.retryAfterMs,
});

describe('toServerError', () => {
  it('keeps a response body code, status and message', () => {
    const error = toServerError(responseError(403, BODY), 'browse', 1000);
    expect(isServerError(error)).toBe(true);
    expect(fields(error)).toEqual({
      code: 'SERVER_OUT_OF_SCOPE',
      status: 403,
      message: 'Path is outside your scopes',
      retryAfterMs: undefined,
    });
    expect(error.body).toEqual(BODY);
    expect(error.name).toBe('ServerError');
  });

  it('carries Retry-After as milliseconds', () => {
    const error = toServerError(
      responseError(
        503,
        { code: 'SERVER_RUNNER_UNAVAILABLE', message: 'down' },
        { 'retry-after': '7' },
      ),
      'runnerListJobs',
      1000,
    );
    expect(fields(error)).toEqual({
      code: 'SERVER_RUNNER_UNAVAILABLE',
      status: 503,
      message: 'down',
      retryAfterMs: 7000,
    });
  });

  it('falls back to http_<status>, the status text and HTTP <status>', () => {
    const masked = toServerError(
      responseError(500, {
        code: '',
        error: 'Internal Server Error',
        message: '',
      }),
      'status',
      1000,
    );
    expect(fields(masked)).toMatchObject({
      code: 'http_500',
      message: 'Internal Server Error',
    });
    const bare = toServerError(responseError(502), 'status', 1000);
    expect(fields(bare)).toMatchObject({
      code: 'http_502',
      message: 'HTTP 502',
    });
    expect(bare.body).toBeUndefined();
  });

  it('maps invalid input to invalid_request, nothing sent', () => {
    const issues = [{ code: 'custom', path: ['*'], message: 'Required' }];
    const error = toServerError(
      new CatalogClientError('Invalid input for "browse": * Required', {
        status: 0,
        issues: issues as never,
      }),
      'browse',
      1000,
    );
    expect(fields(error)).toMatchObject({
      code: 'invalid_request',
      status: 0,
      message: 'Invalid input for "browse": * Required',
    });
    expect(error.issues).toEqual(issues);
  });

  it('maps a 2xx that fails its schema to invalid_response with status 0', () => {
    const error = toServerError(
      new CatalogClientError('bad', { status: 200, issues: [] }),
      'drives',
      1000,
    );
    expect(fields(error)).toMatchObject({
      code: 'invalid_response',
      status: 0,
      message: 'drives response did not match the expected shape',
    });
  });

  it('maps a timeout, a non-JSON body and a network failure', () => {
    const timeout = new DOMException('timed out', 'TimeoutError');
    const clientError = (cause: unknown) =>
      new CatalogClientError('x request failed', { status: 0, cause });

    expect(fields(toServerError(clientError(timeout), 'export', 600))).toEqual({
      code: 'timeout',
      status: 0,
      message: 'export timed out after 600 ms',
      retryAfterMs: undefined,
    });
    expect(
      fields(toServerError(clientError(new SyntaxError('bad')), 'health', 1)),
    ).toMatchObject({
      code: 'invalid_response',
      status: 0,
      message: 'health returned a response that is not JSON',
    });
    expect(
      fields(
        toServerError(clientError(new TypeError('fetch failed')), 'health', 1),
      ),
    ).toMatchObject({
      code: 'network_error',
      status: 0,
      message: 'health request failed: fetch failed',
    });
  });

  it('maps anything else to network_error', () => {
    expect(fields(toServerError('boom', 'health', 1))).toMatchObject({
      code: 'network_error',
      status: 0,
      message: 'health request failed: boom',
    });
  });
});

describe('ServerError', () => {
  it('leaves the optional fields it was not given undefined', () => {
    const error = new ServerError({ code: 'timeout', status: 0, message: 'm' });
    expect(error).toMatchObject({ code: 'timeout', status: 0, message: 'm' });
    expect([error.retryAfterMs, error.body, error.issues]).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
    expect('cause' in error).toBe(false);
    expect(isServerError(new Error('m'))).toBe(false);
  });
});
