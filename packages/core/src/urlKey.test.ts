import { describe, expect, it } from 'vitest';

import { getUrlKey } from './urlKey.js';

describe('getUrlKey', () => {
  it.each([
    ['k alone', { k: 'abc' }, 'abc'],
    ['key alone', { key: 'abc' }, 'abc'],
    ['both (k wins)', { k: 'new', key: 'old' }, 'new'],
    ['empty k falls back to key', { k: '', key: 'old' }, 'old'],
    ['repeated k uses the first', { k: ['one', 'two'] }, 'one'],
    ['repeated key uses the first', { key: ['one', 'two'] }, 'one'],
    ['empty k and empty key', { k: '', key: '' }, undefined],
    ['neither', { exp: '1' }, undefined],
    ['non-string value', { k: 42 }, undefined],
  ])('parsed query: %s', (_label, query, expected) => {
    expect(getUrlKey(query)).toBe(expected);
  });

  it.each([
    ['k alone', '?k=abc', 'abc'],
    ['key alone', '?key=abc', 'abc'],
    ['both (k wins)', '?key=old&k=new', 'new'],
    ['empty k falls back to key', '?k=&key=old', 'old'],
    ['repeated k uses the first', '?k=one&k=two', 'one'],
    ['neither', '?d=1', undefined],
  ])('URLSearchParams: %s', (_label, search, expected) => {
    expect(getUrlKey(new URLSearchParams(search))).toBe(expected);
  });

  it('returns undefined for missing or non-object queries', () => {
    expect(getUrlKey(undefined)).toBeUndefined();
    expect(getUrlKey(null)).toBeUndefined();
    expect(getUrlKey('k=abc')).toBeUndefined();
  });
});
