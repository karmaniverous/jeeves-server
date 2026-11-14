/**
 * Tests for the cache path index: keys fold case only on Windows, so clearing one file never clears another that differs only in case on a case-sensitive file system.
 *
 * @packageDocumentation
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterAll, afterEach, describe, expect, it } from 'vitest';

import { addToPathIndex, indexKey, takeFromPathIndex } from './pathIndex.js';

describe('indexKey', () => {
  it.each([
    ['win32', 'C:\\Docs\\A.md', 'c:/docs/a.md'],
    ['linux', '/docs/A.md', '/docs/A.md'],
    ['darwin', '/docs/A.md', '/docs/A.md'],
    ['linux', 'x\\Y', 'x/Y'],
  ] as const)('%s: %s -> %s', (platform, fsPath, key) => {
    expect(indexKey(fsPath, platform)).toBe(key);
  });
});

describe('takeFromPathIndex', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'path-index-'));
  const file = path.join(dir, 'index.json');

  afterEach(() => {
    fs.rmSync(file, { force: true });
  });

  afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  // Keys fold case on Windows by design; Linux CI runs this.
  it.skipIf(process.platform === 'win32')(
    'keeps a path that differs only in case',
    () => {
      addToPathIndex(file, '/d/A.md', ['upper']);
      addToPathIndex(file, '/d/a.md', ['lower']);
      expect(takeFromPathIndex(file, '/d/a.md', false)).toEqual(['lower']);
      expect(takeFromPathIndex(file, '/d/A.md', false)).toEqual(['upper']);
    },
  );

  it('takes a directory and everything under it', () => {
    addToPathIndex(file, path.join(dir, 'd', 'a.md'), ['a']);
    addToPathIndex(file, path.join(dir, 'dx', 'b.md'), ['b']);
    expect(takeFromPathIndex(file, path.join(dir, 'd'), true)).toEqual(['a']);
  });
});
