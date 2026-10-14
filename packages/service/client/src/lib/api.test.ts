import { describe, expect, it } from 'vitest';

import { buildAuthSuffix } from './api';

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
