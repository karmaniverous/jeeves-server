import {
  SERVER_ERROR_CODES,
  SERVER_ERROR_STATUS,
} from '@karmaniverous/jeeves-server-core';
import { describe, expect, it } from 'vitest';

import * as errors from './errors.js';

/** An error class from `defineError`. */
type ErrorClass = new (...args: string[]) => Error & {
  code: string;
  statusCode: number;
};

/** Code and status of each exported error class's errors. */
const defined = (Object.values(errors) as unknown[])
  .filter(
    (value): value is ErrorClass =>
      typeof value === 'function' && value.name === 'FastifyError',
  )
  .map((ErrorClass) => {
    const { code, statusCode } = new ErrorClass('x', 'y');
    return { code, statusCode };
  });

describe('error classes', () => {
  it('define exactly one class per core code', () => {
    expect(defined.map(({ code }) => code).sort()).toEqual(
      [...SERVER_ERROR_CODES].sort(),
    );
  });

  it.each([...SERVER_ERROR_CODES])("%s carries core's status", (code) => {
    expect(defined.filter((d) => d.code === code)).toEqual([
      { code, statusCode: SERVER_ERROR_STATUS[code] },
    ]);
  });

  it('format a %s message from its argument', () => {
    expect(new errors.NotFound('File not found').message).toBe(
      'File not found',
    );
  });

  it('format the archive size arguments', () => {
    expect(new errors.ArchiveTooLarge('2', '1').message).toBe(
      'Directory too large for archive export (2MB, max 1MB)',
    );
  });

  it.each([
    [errors.OutOfScope, 'Path is outside your access scope'],
    [errors.RunnerUnavailable, 'Runner unreachable'],
    [errors.OAuthRefreshFailed, 'Re-authorization required'],
    [errors.InternalKeyMissing, 'Unavailable: no _internal key is configured'],
    [errors.EmailUnavailable, 'The sign-in email could not be sent'],
    [errors.SignInRejected, 'Sign-in is not allowed for this account'],
  ])('fixed message %#', (ErrorClass, message) => {
    expect(new ErrorClass().message).toBe(message);
  });
});

describe('capArg', () => {
  it('returns a short value unchanged', () => {
    expect(errors.capArg('explode')).toBe('explode');
  });

  it('keeps a value of exactly the maximum', () => {
    const value = 'a'.repeat(errors.MESSAGE_ARG_MAX);
    expect(errors.capArg(value)).toBe(value);
  });

  it('cuts a longer value to the maximum with an ellipsis', () => {
    const capped = errors.capArg('a'.repeat(errors.MESSAGE_ARG_MAX + 1));
    expect(Array.from(capped)).toHaveLength(errors.MESSAGE_ARG_MAX);
    expect(capped.endsWith('a…')).toBe(true);
  });

  it('never splits a surrogate pair', () => {
    const capped = errors.capArg('😀'.repeat(errors.MESSAGE_ARG_MAX + 5));
    expect(Array.from(capped)).toHaveLength(errors.MESSAGE_ARG_MAX);
    expect(capped.endsWith('😀…')).toBe(true);
  });
});
