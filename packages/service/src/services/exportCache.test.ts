// @vitest-environment node
/**
 * Tests for the export cache: storing and reading entries (with the print
 * style beside a PDF), clearing a file's or a directory's entries through
 * the per-file index, and the diagram reverse index.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  cacheExport,
  clearDiagramCacheForFile,
  clearExportCache,
  getCachedExport,
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

/** Cache an entry: key `<name>-<format>` holding `bytes of <name>`. */
const store = (fsPath: string, name: string, format = 'pdf') => {
  cacheExport({
    fsPath,
    key: `${name}-${format}`,
    format,
    buffer: Buffer.from(`bytes of ${name}`),
    printStyle: 'default',
  });
};

const hit = (name: string, format = 'pdf') =>
  getCachedExport(`${name}-${format}`, format)?.buffer.toString() ?? null;

describe('export entries', () => {
  it('stores in the configured directory and reads back by key', () => {
    store('/docs/a.md', 'a');
    store('/docs/a.md', 'a', 'docx');

    expect(fs.readdirSync(cacheDir).sort()).toEqual([
      '_export-index.json',
      'a-docx.docx',
      'a-pdf.json',
      'a-pdf.pdf',
    ]);
    expect(hit('a')).toBe('bytes of a');
    expect(hit('a', 'docx')).toBe('bytes of a');
  });

  it('misses an unknown key or format', () => {
    store('/docs/a.md', 'a');

    expect(getCachedExport('b-pdf', 'pdf')).toBeNull();
    expect(getCachedExport('a-pdf', 'docx')).toBeNull();
  });

  it('returns the print style stored beside a PDF only', () => {
    store('/docs/a.md', 'a');
    store('/docs/a.md', 'a', 'docx');

    expect(getCachedExport('a-pdf', 'pdf')?.printStyle).toBe('default');
    expect(getCachedExport('a-docx', 'docx')).not.toHaveProperty('printStyle');
  });

  it('reads a PDF whose metadata is missing without a style', () => {
    store('/docs/a.md', 'a');
    fs.rmSync(path.join(cacheDir, 'a-pdf.json'));

    expect(getCachedExport('a-pdf', 'pdf')).toEqual({
      buffer: Buffer.from('bytes of a'),
    });
  });

  it('clears every entry of a file and nothing else', () => {
    store('D:\\Docs\\A.md', 'a1');
    store('D:/Docs/A.md', 'a2', 'docx');
    store('D:/Docs/A.md.bak', 'other');

    expect(clearExportCache('D:/Docs/A.md')).toBe(2);

    expect(hit('a1')).toBeNull();
    expect(hit('a2', 'docx')).toBeNull();
    expect(hit('other')).toBe('bytes of other');
    expect(fs.existsSync(path.join(cacheDir, 'a1-pdf.json'))).toBe(false);
    expect(clearExportCache('D:/Docs/A.md')).toBe(0);
  });

  it('clears every entry under a directory', () => {
    store('/docs/a.md', 'a');
    store('/docs/sub/b.md', 'b');
    store('/docs2/c.md', 'c');

    expect(clearExportCache('/docs')).toBe(2);

    expect(hit('a')).toBeNull();
    expect(hit('b')).toBeNull();
    expect(hit('c')).toBe('bytes of c');
  });

  it('clears everything under a root ending in a separator', () => {
    store('/docs/a.md', 'a');

    expect(clearExportCache('/')).toBe(1);
  });
});

describe('clearDiagramCacheForFile', () => {
  it('deletes the file’s cached diagrams and drops only its index entry', () => {
    registerDiagramHashes('D:\\Docs\\A.md', ['h1', 'h2']);
    registerDiagramHashes('/docs/b.md', ['h3']);
    for (const name of ['h1.svg', 'h1.png', 'h2.svg', 'h3.svg']) {
      fs.writeFileSync(path.join(diagramDir, name), 'x');
    }

    expect(clearDiagramCacheForFile('D:/Docs/A.md', diagramDir)).toBe(3);

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
