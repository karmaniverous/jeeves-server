import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { mapDirectoryEntry } from './directory.js';

describe('directory entry mapping', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jeeves-dir-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns itemCount for directory entries', async () => {
    const subDir = path.join(tmpDir, 'sub');
    fs.mkdirSync(subDir);
    fs.writeFileSync(path.join(subDir, 'a.txt'), 'a');
    fs.writeFileSync(path.join(subDir, 'b.txt'), 'b');

    const entries = fs.readdirSync(tmpDir, { withFileTypes: true });
    const dirEntry = entries.find((e) => e.name === 'sub');
    expect(dirEntry).toBeDefined();
    const mapped = await mapDirectoryEntry(dirEntry!, tmpDir);
    expect(mapped.type).toBe('directory');
    expect(mapped.itemCount).toBe(2);
  });

  it('returns null itemCount for file entries', async () => {
    fs.writeFileSync(path.join(tmpDir, 'file.txt'), 'content');
    const entries = fs.readdirSync(tmpDir, { withFileTypes: true });
    const fileEntry = entries.find((e) => e.name === 'file.txt');
    expect(fileEntry).toBeDefined();
    const mapped = await mapDirectoryEntry(fileEntry!, tmpDir);
    expect(mapped.type).toBe('file');
    expect(mapped.itemCount).toBeNull();
    expect(mapped.size).toBeGreaterThan(0);
  });

  it('counts mixed contents (files + subdirectories)', async () => {
    const subDir = path.join(tmpDir, 'mixed');
    fs.mkdirSync(subDir);
    fs.writeFileSync(path.join(subDir, 'file1.txt'), 'a');
    fs.writeFileSync(path.join(subDir, 'file2.txt'), 'b');
    fs.mkdirSync(path.join(subDir, 'nested'));

    const entries = fs.readdirSync(tmpDir, { withFileTypes: true });
    const dirEntry = entries.find((e) => e.name === 'mixed');
    expect(dirEntry).toBeDefined();
    const mapped = await mapDirectoryEntry(dirEntry!, tmpDir);
    expect(mapped.itemCount).toBe(3);
  });

  it('returns null itemCount when directory read fails', async () => {
    const fakeDirent = {
      name: 'nonexistent',
      isDirectory: () => true,
      isFile: () => false,
      isBlockDevice: () => false,
      isCharacterDevice: () => false,
      isFIFO: () => false,
      isSocket: () => false,
      isSymbolicLink: () => false,
      parentPath: tmpDir,
      path: tmpDir,
    } as fs.Dirent;

    const mapped = await mapDirectoryEntry(fakeDirent, tmpDir);
    expect(mapped.itemCount).toBeNull();
    expect(mapped.mtime).toBeNull();
  });
});
