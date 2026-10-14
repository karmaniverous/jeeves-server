import { describe, expect, it } from 'vitest';

import { getUrlKey, LEGACY_URL_KEY_PARAM, URL_KEY_PARAM } from './urlKey.js';

describe('getUrlKey', () => {
  it('uses k as the generated name and key as the legacy name', () => {
    expect(URL_KEY_PARAM).toBe('k');
    expect(LEGACY_URL_KEY_PARAM).toBe('key');
  });

  it.each([
    ['k alone', { k: 'abc' }, 'abc'],
    ['key alone', { key: 'abc' }, 'abc'],
    ['both (k wins)', { k: 'new', key: 'old' }, 'new'],
    ['empty k falls back to key', { k: '', key: 'old' }, 'old'],
    ['repeated k uses the first', { k: ['one', 'two'] }, 'one'],
    ['neither', { exp: '1' }, undefined],
    ['non-string value', { k: 42 }, undefined],
  ])('parsed query: %s', (_label, query, expected) => {
    expect(getUrlKey(query)).toBe(expected);
  });

  it.each([
    ['k alone', '?k=abc', 'abc'],
    ['key alone', '?key=abc', 'abc'],
    ['both (k wins)', '?key=old&k=new', 'new'],
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
