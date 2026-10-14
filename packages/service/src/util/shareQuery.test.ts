/**
 * Auth query strings: keys travel as `k`; deep queries always carry `d`.
 *
 * @packageDocumentation
 */

import { getUrlKey } from '@karmaniverous/jeeves-server-core';
import { describe, expect, it } from 'vitest';

import { deepShareQuery, pathKeyQuery } from './shareQuery.js';

describe('pathKeyQuery', () => {
  it('carries the key as k, without exp when none is given', () => {
    expect(pathKeyQuery('abc')).toBe('k=abc');
  });

  it('appends exp when the key expires', () => {
    expect(pathKeyQuery('abc', '1700000000')).toBe('k=abc&exp=1700000000');
  });

  it('is read back by getUrlKey', () => {
    expect(getUrlKey(new URLSearchParams(pathKeyQuery('abc', '9')))).toBe(
      'abc',
    );
  });
});

describe('deepShareQuery', () => {
  it('emits k, d (also 0), dirs and s in order', () => {
    expect(deepShareQuery('abc', { depth: 0, dirs: false, stack: 'STK' })).toBe(
      'k=abc&d=0&dirs=0&s=STK',
    );
  });

  it('marks dirs and appends exp when set', () => {
    expect(
      deepShareQuery('abc', { depth: 2, dirs: true, stack: 'S', exp: '9' }),
    ).toBe('k=abc&d=2&dirs=1&s=S&exp=9');
  });

  it('omits an empty exp', () => {
    expect(
      deepShareQuery('abc', { depth: 1, dirs: false, stack: 'S', exp: '' }),
    ).toBe('k=abc&d=1&dirs=0&s=S');
  });
});
