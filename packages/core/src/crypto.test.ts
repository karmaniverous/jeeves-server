/**
 * Known-vector tests for the link-key functions core re-exports from
 * `@karmaniverous/jeeves` (#307). Every vector was computed with core's own
 * implementation before it was deleted (branch base f0b1417): equal output
 * here means links signed before and after the switch stay valid.
 */

import { describe, expect, it } from 'vitest';

import {
  computeInsiderKey,
  computeOutsiderKeyWithExpiry,
  computePathKey,
} from './index.js';

const SEED = 'test-api-key-12345';
const EXPIRY = 1700000000000;

describe('link keys (re-exported from @karmaniverous/jeeves)', () => {
  it.for([
    [SEED, '/foo/bar', '472ea1e2d5279dc4c890af12c5066fa6'],
    [SEED, '/Foo/Bar/', '472ea1e2d5279dc4c890af12c5066fa6'],
    [SEED, '/baz/qux', 'c5eb7d57fbb2f0167de687344d74d0c4'],
    ['api-key-1', '/foo/bar', 'a7f701cbea2295df3ffbac0473b253cd'],
    ['api-key-2', '/foo/bar', 'b77bd2cca12c3aab55d0d6021dfb3e1f'],
    [SEED, '///', 'a4debb563f182527222c45adadcb77fd'],
  ] as const)('computePathKey(%s, %s) is %s', ([seed, path, key]) => {
    expect(computePathKey(seed, path)).toBe(key);
  });

  it.for([
    [SEED, '355bee14c1157e323470b5eca15f93e2'],
    ['api-key-1', 'fb5b03316b850a75779df5f6072ffce9'],
    ['api-key-2', 'df921e68ca274cab2a44180f4008865f'],
  ] as const)('computeInsiderKey(%s) is %s', ([seed, key]) => {
    expect(computeInsiderKey(seed)).toBe(key);
  });

  it.for([
    [EXPIRY, 'c0244090e57629bbe84a4e42d8c747d6'],
    [String(EXPIRY), 'c0244090e57629bbe84a4e42d8c747d6'],
    [1800000000000, '40b21f64f6c6465bdef42a6056d4f476'],
  ] as const)(
    'computeOutsiderKeyWithExpiry(seed, /foo/bar, %s) is %s',
    ([expiry, key]) => {
      expect(computeOutsiderKeyWithExpiry(SEED, '/foo/bar', expiry)).toBe(key);
    },
  );
});
