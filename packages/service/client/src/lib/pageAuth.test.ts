import { describe, expect, it } from 'vitest';

import {
  buildAuthSuffix,
  pageAuth,
  pageShareCredential,
  withPageCredential,
} from './pageAuth';

describe('pageShareCredential', () => {
  it('reads the key and every share parameter present', () => {
    expect(
      pageShareCredential('?k=abc&d=2&dirs=1&s=xyz&exp=9&tab=raw'),
    ).toEqual({ k: 'abc', d: '2', dirs: '1', s: 'xyz', exp: '9' });
  });

  it('reads a legacy key as k', () => {
    expect(pageShareCredential('?key=abc&exp=9')).toEqual({
      k: 'abc',
      exp: '9',
    });
  });

  it('is undefined without a key', () => {
    expect(pageShareCredential('?d=2&exp=9')).toBeUndefined();
  });
});

describe('pageAuth', () => {
  it('uses the share credential when the page has one', () => {
    expect(pageAuth({ k: 'abc', exp: '9' })).toEqual({
      share: { k: 'abc', exp: '9' },
    });
  });

  it('uses the browser session otherwise', () => {
    expect(pageAuth(undefined)).toEqual({ session: true });
  });
});

describe('withPageCredential', () => {
  it('adds the share parameters, keeping the query already present', () => {
    expect(
      withPageCredential('/api/raw/j/a.svg?raw=1', { k: 'abc', exp: '9' }),
    ).toBe('/api/raw/j/a.svg?raw=1&k=abc&exp=9');
  });

  it('leaves the URL alone without a credential', () => {
    expect(withPageCredential('/api/raw/j/a.svg', undefined)).toBe(
      '/api/raw/j/a.svg',
    );
  });
});

describe('buildAuthSuffix (#279)', () => {
  it('forwards a k key as k', () => {
    expect(buildAuthSuffix('?k=abc')).toBe('k=abc');
  });

  it('forwards a legacy key param as k', () => {
    expect(buildAuthSuffix('?key=abc')).toBe('k=abc');
  });

  it('prefers k when both names are present', () => {
    expect(buildAuthSuffix('?key=old&k=new')).toBe('k=new');
  });

  it('forwards deep share params alongside the key', () => {
    expect(buildAuthSuffix('?k=abc&d=2&dirs=1&s=xyz&exp=9&tab=raw')).toBe(
      'k=abc&d=2&dirs=1&s=xyz&exp=9',
    );
  });

  it('falls back to the legacy key when k is empty', () => {
    expect(buildAuthSuffix('?k=&key=old&d=1')).toBe('k=old&d=1');
  });

  it('is empty without a key', () => {
    expect(buildAuthSuffix('?d=2&s=xyz')).toBe('');
  });
});
