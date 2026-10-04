/**
 * Tests for getDirSize, including the scope-aware file filter used by
 * directory archive export.
 *
 * @packageDocumentation
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getDirSize } from './platform.js';

describe('getDirSize', () => {
  let tmpDir = '';

  const write = (rel: string, bytes: number) => {
    const p = path.join(tmpDir, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, Buffer.alloc(bytes));
  };

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jeeves-size-'));
    write('a.txt', 10);
    write('sub/b.txt', 20);
    write('sub/deep/c.txt', 40);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('sums all files recursively', () => {
    expect(getDirSize(tmpDir)).toBe(70);
  });

  it('counts only files the filter includes, by /-separated relative path', () => {
    const seen: string[] = [];
    const size = getDirSize(tmpDir, (rel) => {
      seen.push(rel);
      return !rel.startsWith('sub/deep/');
    });
    expect(size).toBe(30);
    expect(seen.sort()).toEqual(['a.txt', 'sub/b.txt', 'sub/deep/c.txt']);
  });

  it('returns 0 for an unreadable directory', () => {
    expect(getDirSize(path.join(tmpDir, 'missing'))).toBe(0);
  });
});
