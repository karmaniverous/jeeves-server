/**
 * `SERVER_ERROR_CODES` / `SERVER_ERROR_STATUS` (next-api-catalog.md, Errors): the code list with one status per code.
 */

import { describe, expect, it } from 'vitest';

import { SERVER_ERROR_CODES, SERVER_ERROR_STATUS } from './errors.js';

describe('server error codes', () => {
  it('lists each code of the error contract once, with its status', () => {
    expect(
      Object.fromEntries(
        SERVER_ERROR_CODES.map((c) => [c, SERVER_ERROR_STATUS[c]]),
      ),
    ).toEqual({
      SERVER_UNAUTHORIZED: 401,
      SERVER_FORBIDDEN: 403,
      SERVER_OUT_OF_SCOPE: 403,
      SERVER_INSIDER_REQUIRED: 403,
      SERVER_INVALID_PATH: 400,
      SERVER_NOT_FOUND: 404,
      SERVER_NOT_A_FILE: 400,
      SERVER_NOT_A_DIRECTORY: 400,
      SERVER_EXPORT_UNSUPPORTED: 400,
      SERVER_EXPORT_FAILED: 502,
      SERVER_ARCHIVE_TOO_LARGE: 413,
      SERVER_CHROME_UNAVAILABLE: 503,
      SERVER_WATCHER_UNAVAILABLE: 502,
      SERVER_RUNNER_UNAVAILABLE: 503,
      SERVER_MACHINE_KEY_NOT_ROTATABLE: 403,
      SERVER_EMAIL_UNAVAILABLE: 500,
      SERVER_INTERNAL_KEY_MISSING: 500,
      SERVER_CONFLICT: 409,
      SERVER_SIGN_IN_REJECTED: 403,
      SERVER_INVALID_REQUEST: 400,
      SERVER_NOT_CONFIGURED: 501,
      SERVER_OAUTH_REFRESH_FAILED: 401,
    });
    expect(new Set(SERVER_ERROR_CODES).size).toBe(SERVER_ERROR_CODES.length);
  });

  it('gives every status to its own code only (no stray statuses)', () => {
    expect(Object.keys(SERVER_ERROR_STATUS).sort()).toEqual(
      [...SERVER_ERROR_CODES].sort(),
    );
  });
});
