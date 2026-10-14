/**
 * Share links rooted at a path: the URL carries exactly the key that
 * verification recomputes for that path and those params.
 *
 * @packageDocumentation
 */

import { describe, expect, it } from 'vitest';

import {
  computeDeepShareKey,
  computeOutsiderKeyWithExpiry,
  computePathKey,
} from '../util/crypto.js';
import { decodeStack } from './deepShareLinks.js';
import { createDeepShare, createPathShare } from './shareLinks.js';

const SEED = 'share-links-seed';

describe('createPathShare', () => {
  it('uses a plain path key without expiry', () => {
    const share = createPathShare(SEED, '/j/docs/a.md');
    expect(share.key).toBe(computePathKey(SEED, '/j/docs/a.md'));
    expect(share.url).toBe(`/browse/j/docs/a.md?k=${share.key}`);
  });

  it('uses an expiring key bound to exp when one is given', () => {
    const share = createPathShare(SEED, '/j/docs/a.md', '1700000000');
    expect(share.key).toBe(
      computeOutsiderKeyWithExpiry(SEED, '/j/docs/a.md', '1700000000'),
    );
    expect(share.key).not.toBe(computePathKey(SEED, '/j/docs/a.md'));
    expect(share.url).toBe(`/browse/j/docs/a.md?k=${share.key}&exp=1700000000`);
  });
});

describe('createDeepShare', () => {
  it('roots the stack at the target and keys it with the deep params', () => {
    const share = createDeepShare(SEED, '/j/docs/a.md', {
      depth: 2,
      dirs: true,
      exp: '9',
    });
    const url = new URL(share.url, 'http://x');
    const stack = url.searchParams.get('s') ?? '';

    expect(url.pathname).toBe('/browse/j/docs/a.md');
    expect(decodeStack(stack)).toEqual(['/j/docs/a.md']);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      k: share.key,
      d: '2',
      dirs: '1',
      s: stack,
      exp: '9',
    });
    expect(share.key).toBe(
      computeDeepShareKey(SEED, '/j/docs/a.md', {
        depth: 2,
        dirs: true,
        stack,
        exp: '9',
      }),
    );
  });

  it('emits d=0 for a zero-depth share and no exp when none is given', () => {
    const share = createDeepShare(SEED, '/j/a.md', { depth: 0, dirs: false });
    const params = new URL(share.url, 'http://x').searchParams;
    expect(params.get('d')).toBe('0');
    expect(params.get('dirs')).toBe('0');
    expect(params.has('exp')).toBe(false);
  });
});
