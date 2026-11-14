import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { loadPrintStyle, MAX_PRINT_STYLE_BYTES } from './printStyleLoader.js';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'print-loader-'));
// Files may live anywhere readable (Decision 23): CSS, templates and
// assets in three unrelated directories.
const cssFile = path.join(tmpDir, 'css', 'brief.css');
const footerFile = path.join(tmpDir, 'templates', 'footer.html');
const assets = path.join(tmpDir, 'brand');
const logo = path.join(assets, 'logo.png');

let n = 0;
/** A fresh style name, so each test starts with an empty cache entry. */
const fresh = () => `s${String(++n)}`;

/** Rewrite a file with a different size, so its stamp changes. */
const rewrite = (file: string, text: string) => {
  fs.writeFileSync(file, text);
};

beforeEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  for (const f of [cssFile, footerFile, logo])
    fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(cssFile, 'h1 { background: url(logo.png); }');
  fs.writeFileSync(
    footerFile,
    '<img src="logo.png"><span class="pageNumber"></span>',
  );
  fs.writeFileSync(logo, 'PNG');
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const config = { css: cssFile, footerTemplate: footerFile, assets };

describe('loadPrintStyle', () => {
  it('reads the CSS and templates and inlines their assets', () => {
    const style = loadPrintStyle('brief', config);
    expect(style.name).toBe('brief');
    expect(style.css).toMatch(
      /^h1 \{ background: url\("data:image\/png;base64,/,
    );
    expect(style.footerTemplate).toMatch(/^<img src="data:image\/png;base64,/);
    expect(style.headerTemplate).toBeUndefined();
    expect(style.fingerprint).toMatch(/^[0-9a-f]{64}$/);
  });

  it('serves an unchanged style from cache without reading files', () => {
    const name = fresh();
    const first = loadPrintStyle(name, config);
    const read = vi.spyOn(fs, 'readFileSync');
    expect(loadPrintStyle(name, config)).toBe(first);
    expect(read).not.toHaveBeenCalled();
    read.mockRestore();
  });

  it.each([
    [
      'the stylesheet',
      () => {
        rewrite(cssFile, 'h1 { color: red; }');
      },
    ],
    [
      'a template',
      () => {
        rewrite(footerFile, '<b>footer</b>');
      },
    ],
    [
      'an inlined asset',
      () => {
        rewrite(logo, 'PNG2');
      },
    ],
  ])('reloads with a new fingerprint when %s changes', (_kind, edit) => {
    const name = fresh();
    const before = loadPrintStyle(name, config);
    edit();
    const after = loadPrintStyle(name, config);
    expect(after.fingerprint).not.toBe(before.fingerprint);
  });

  it('reloads when the style config changes', () => {
    const name = fresh();
    const before = loadPrintStyle(name, config);
    const after = loadPrintStyle(name, { ...config, page: { format: 'A4' } });
    expect(after.page).toEqual({ format: 'A4' });
    expect(after.fingerprint).not.toBe(before.fingerprint);
  });

  it('fingerprints the name, so equal styles answer their own names', () => {
    expect(loadPrintStyle(fresh(), config).fingerprint).not.toBe(
      loadPrintStyle(fresh(), config).fingerprint,
    );
  });

  it('throws when a file is missing', () => {
    expect(() =>
      loadPrintStyle(fresh(), { css: path.join(tmpDir, 'none.css') }),
    ).toThrow();
  });

  it('refuses a style over the inlined size limit', () => {
    fs.writeFileSync(logo, Buffer.alloc(MAX_PRINT_STYLE_BYTES));
    expect(() => loadPrintStyle(fresh(), config)).toThrow(/exceeds/);
  });

  it('accepts a style at the size limit', () => {
    rewrite(cssFile, 'x'.repeat(MAX_PRINT_STYLE_BYTES));
    expect(loadPrintStyle(fresh(), { css: cssFile }).css).toHaveLength(
      MAX_PRINT_STYLE_BYTES,
    );
  });
});
