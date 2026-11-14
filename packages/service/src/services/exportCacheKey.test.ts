// @vitest-environment node
/**
 * Tests for the export cache key (#288): the same document, format, style,
 * version and images give the same key (a hit); changing any one of them,
 * or the document's path, gives a new key (a miss).
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { packageVersion } from '../util/packageVersion.js';
import {
  DEFAULT_PRINT_STYLE,
  documentExportKey,
  type DocumentExportKeyOptions,
} from './exportCacheKey.js';
import { contentHashOf } from './markdownDocument.js';

let dir: string;
let docPath: string;
let imagePath: string;

const SOURCE = '# Doc\n\n![chart](img/chart.png)\n';

const doc = (source = SOURCE) => ({
  source,
  contentHash: contentHashOf(source),
});

const keyOf = (
  options: Partial<DocumentExportKeyOptions> = {},
  format = 'pdf',
  source = SOURCE,
  fsPath = docPath,
) => documentExportKey(fsPath, doc(source), format, { roots: [], ...options });

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'export-key-'));
  docPath = path.join(dir, 'doc.md');
  imagePath = path.join(dir, 'img', 'chart.png');
  fs.mkdirSync(path.dirname(imagePath));
  fs.writeFileSync(docPath, SOURCE);
  fs.writeFileSync(imagePath, 'png-1');
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('documentExportKey', () => {
  it('is stable for an unchanged document (a hit)', () => {
    const key = keyOf();
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(keyOf()).toBe(key);
    expect(keyOf({ version: packageVersion, style: DEFAULT_PRINT_STYLE })).toBe(
      key,
    );
  });

  it('changes when the content changes', () => {
    expect(keyOf({}, 'pdf', `${SOURCE}\nMore.\n`)).not.toBe(keyOf());
  });

  it('changes when a referenced image changes', () => {
    const before = keyOf();
    fs.writeFileSync(imagePath, 'png-2 is longer');
    expect(keyOf()).not.toBe(before);
  });

  it('changes when a referenced image is touched', () => {
    const before = keyOf();
    const later = new Date(Date.now() + 60_000);
    fs.utimesSync(imagePath, later, later);
    expect(keyOf()).not.toBe(before);
  });

  it('changes when a referenced image is removed', () => {
    const before = keyOf();
    fs.rmSync(imagePath);
    expect(keyOf()).not.toBe(before);
  });

  it('ignores files the document does not reference', () => {
    const before = keyOf();
    fs.writeFileSync(path.join(dir, 'img', 'other.png'), 'x');
    expect(keyOf()).toBe(before);
  });

  it('changes when the server version changes', () => {
    expect(keyOf({ version: '0.0.0-other' })).not.toBe(keyOf());
  });

  it('changes when the format changes', () => {
    expect(keyOf({}, 'docx')).not.toBe(keyOf({}, 'pdf'));
  });

  it('changes when the print style fingerprint changes', () => {
    expect(
      keyOf({ style: { name: 'default', fingerprint: 'edited' } }),
    ).not.toBe(keyOf());
  });

  it('changes with the document path, not its case or separators', () => {
    const other = path.join(dir, 'copy.md');
    expect(keyOf({}, 'pdf', SOURCE, other)).not.toBe(keyOf());
    const plain = '# No images\n';
    expect(keyOf({}, 'pdf', plain, 'D:\\Docs\\Doc.md')).toBe(
      keyOf({}, 'pdf', plain, 'd:/docs/doc.md'),
    );
  });
});
