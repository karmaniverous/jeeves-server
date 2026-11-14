/**
 * Auth query strings: keys travel as `k`; deep queries always carry `d`.
 *
 * @packageDocumentation
 */

import { getUrlKey } from '@karmaniverous/jeeves-server-core';
import { describe, expect, it } from 'vitest';

import {
  deepShareQuery,
  pathKeyQuery,
  withCredentialQuery,
} from './shareQuery.js';

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

describe('withCredentialQuery (#316)', () => {
  it('adds the credential to a URL without a query', () => {
    expect(withCredentialQuery('/api/raw/a.pdf', 'k=1')).toBe(
      '/api/raw/a.pdf?k=1',
    );
  });

  it('keeps other parameters as written, before the credential, and the fragment last', () => {
    expect(
      withCredentialQuery('/api/raw/a.pdf?download=1&x=a%20b#p', 'k=1'),
    ).toBe('/api/raw/a.pdf?download=1&x=a%20b&k=1#p');
  });

  it('replaces every credential parameter, under any name', () => {
    expect(
      withCredentialQuery(
        '/b?k=o&key=o&exp=1&download=1&d=2&dirs=1&s=x&%6B=o&',
        'k=1&d=0',
      ),
    ).toBe('/b?download=1&k=1&d=0');
  });

  it('keeps a parameter whose name is not decodable', () => {
    expect(withCredentialQuery('/b?%E0=1', 'k=1')).toBe('/b?%E0=1&k=1');
  });
});
