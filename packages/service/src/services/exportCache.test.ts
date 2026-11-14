// @vitest-environment node
/**
 * Tests for the diagram reverse index of the export cache: registering a
 * file's diagram hashes and clearing them.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  clearDiagramCacheForFile,
  initExportCache,
  registerDiagramHashes,
} from './exportCache.js';

let root: string;
let cacheDir: string;
let diagramDir: string;

const indexFile = (): Record<string, string[]> =>
  JSON.parse(
    fs.readFileSync(path.join(cacheDir, '_diagram-index.json'), 'utf8'),
  ) as Record<string, string[]>;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'export-cache-'));
  cacheDir = path.join(root, 'export');
  diagramDir = path.join(root, 'diagrams');
  fs.mkdirSync(diagramDir);
  initExportCache(cacheDir);
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe('clearDiagramCacheForFile', () => {
  it('deletes the file’s cached diagrams and drops only its index entry', () => {
    registerDiagramHashes('D:\\Docs\\A.md', ['h1', 'h2']);
    registerDiagramHashes('/docs/b.md', ['h3']);
    for (const name of ['h1.svg', 'h1.png', 'h2.svg', 'h3.svg']) {
      fs.writeFileSync(path.join(diagramDir, name), 'x');
    }

    expect(clearDiagramCacheForFile('d:/docs/a.md', diagramDir)).toBe(3);

    expect(fs.readdirSync(diagramDir)).toEqual(['h3.svg']);
    expect(indexFile()).toEqual({ '/docs/b.md': ['h3'] });
  });

  it('returns 0 and leaves the index alone for a file with no diagrams', () => {
    registerDiagramHashes('/docs/b.md', ['h3']);

    expect(clearDiagramCacheForFile('/docs/a.md', diagramDir)).toBe(0);

    expect(indexFile()).toEqual({ '/docs/b.md': ['h3'] });
  });

  it('returns 0 without a diagram cache directory', () => {
    registerDiagramHashes('/docs/a.md', ['h1']);

    expect(clearDiagramCacheForFile('/docs/a.md', null)).toBe(0);

    expect(indexFile()).toEqual({ '/docs/a.md': ['h1'] });
  });
});
