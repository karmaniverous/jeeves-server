/**
 * Tests for the deep share stack helpers: the request's deep share context
 * and which directories a deep link may list.
 */

import LZString from 'lz-string';
import { describe, expect, it } from 'vitest';

import {
  canListDirectory,
  decodeStack,
  encodeStack,
  normalizeTargetPath,
  toDeepShareContext,
} from './deepShareStack.js';

describe('toDeepShareContext', () => {
  it('parses depth and dirs and carries the stack and exp', () => {
    expect(toDeepShareContext({ d: '3', dirs: '1', s: 'STK' }, '9')).toEqual({
      maxDepth: 3,
      dirs: true,
      stackCompressed: 'STK',
      exp: '9',
    });
  });

  it.each(['', 'x'])('treats depth %j as 0', (d) => {
    expect(toDeepShareContext({ d, dirs: '0', s: '' }, undefined)).toEqual({
      maxDepth: 0,
      dirs: false,
      stackCompressed: '',
      exp: undefined,
    });
  });

  it('accepts only dirs=1 as dirs', () => {
    expect(
      toDeepShareContext({ d: '1', dirs: 'true', s: '' }, undefined).dirs,
    ).toBe(false);
  });
});

describe('canListDirectory', () => {
  const context = (dirs: boolean, stack: string[]) => ({
    maxDepth: 2,
    dirs,
    stackCompressed: encodeStack(stack),
    exp: undefined,
  });

  it('lets a dirs share list any directory it reaches', () => {
    expect(
      canListDirectory(context(true, ['/r/a.md', '/r/sub']), '/r/sub'),
    ).toBe(true);
  });

  it('without dirs, lists only the shared directory itself (any case)', () => {
    expect(canListDirectory(context(false, ['/r/Docs']), '/r/docs')).toBe(true);
  });

  it('without dirs, refuses a directory reached by a hop', () => {
    expect(
      canListDirectory(context(false, ['/r/a.md', '/r/sub']), '/r/sub'),
    ).toBe(false);
  });

  it('without dirs, refuses another directory and an empty stack', () => {
    expect(canListDirectory(context(false, ['/r/docs']), '/r/other')).toBe(
      false,
    );
    expect(canListDirectory(context(false, []), '/r/docs')).toBe(false);
  });
});

describe('normalizeTargetPath', () => {
  it.each([
    ['/j/docs/a%20b.md', '/j/docs/a b.md'],
    ['/j//docs/./sub/../a.md/', '/j/docs/a.md'],
    ['/j/..', null],
    ['/../j/a.md', null],
    ['/', null],
    ['/j/%E0%A4%A', null],
  ])('%s is %s', (target, path) => {
    expect(normalizeTargetPath(target)).toBe(path);
  });
});

describe('decodeStack', () => {
  it('round-trips encodeStack, and is empty for nothing, garbage or a non-array', () => {
    expect(decodeStack(encodeStack(['/j/a.md', '/j/b']))).toEqual([
      '/j/a.md',
      '/j/b',
    ]);
    expect(decodeStack('')).toEqual([]);
    expect(decodeStack('%%%')).toEqual([]);
    expect(
      decodeStack(LZString.compressToEncodedURIComponent('{oops')),
    ).toEqual([]);
    expect(decodeStack(LZString.compressToEncodedURIComponent('{}'))).toEqual(
      [],
    );
  });
});
