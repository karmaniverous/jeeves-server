import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_PRINT_STYLE } from './exportCacheKey.js';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'print-styles-'));
const cssFile = path.join(tmpDir, 'brief.css');
const headerFile = path.join(tmpDir, 'header.html');

const state = vi.hoisted((): { printStyles: Record<string, unknown> } => ({
  printStyles: {},
}));
vi.mock('../config/index.js', () => ({
  getConfig: () => ({ printStyles: state.printStyles }),
}));

const { DEFAULT_PDF_OPTIONS, expandMargin, pdfOptionsFor, resolvePrintStyle } =
  await import('./printStyles.js');

let file = 0;
/** A fresh document path, so once-per-file logging starts clean. */
const doc = () => `/docs/${String(++file)}.md`;

const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

beforeEach(() => {
  fs.writeFileSync(cssFile, 'h1 { color: navy !important; }');
  fs.writeFileSync(headerFile, '<span class="title"></span>');
  state.printStyles = {
    brief: { css: cssFile, page: { format: 'Letter', margin: '1mm 2mm' } },
    broken: { css: path.join(tmpDir, 'missing.css') },
  };
  warn.mockClear();
  error.mockClear();
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('DEFAULT_PDF_OPTIONS', () => {
  it('are exactly the 3.15.0 options', () => {
    expect(DEFAULT_PDF_OPTIONS).toStrictEqual({
      format: 'A4',
      margin: { top: '1cm', right: '1cm', bottom: '1cm', left: '1cm' },
      printBackground: true,
    });
  });
});

describe('expandMargin', () => {
  it.each([
    ['5mm', ['5mm', '5mm', '5mm', '5mm']],
    ['1mm 2mm', ['1mm', '2mm', '1mm', '2mm']],
    ['1mm 2mm 3mm', ['1mm', '2mm', '3mm', '2mm']],
    [' 1mm  2mm 3mm 4mm ', ['1mm', '2mm', '3mm', '4mm']],
  ])('%s', (margin, [top, right, bottom, left]) => {
    expect(expandMargin(margin)).toEqual({ top, right, bottom, left });
  });
});

describe('pdfOptionsFor', () => {
  const base = { name: 'x', fingerprint: 'f', css: '' };

  it('defaults a named style to A4 and 1 cm, preferring CSS page size', () => {
    expect(pdfOptionsFor(base)).toStrictEqual({
      format: 'a4',
      margin: DEFAULT_PDF_OPTIONS.margin,
      printBackground: true,
      preferCSSPageSize: true,
    });
  });

  it('carries width and height', () => {
    expect(
      pdfOptionsFor({ ...base, page: { width: '8in', height: 600 } }),
    ).toMatchObject({ width: '8in', height: 600 });
  });

  it('shows a configured header and blanks the unset footer', () => {
    expect(
      pdfOptionsFor({ ...base, headerTemplate: '<b>h</b>' }),
    ).toMatchObject({
      displayHeaderFooter: true,
      headerTemplate: '<b>h</b>',
      footerTemplate: '<span></span>',
    });
  });

  it('shows a configured footer and blanks the unset header', () => {
    expect(
      pdfOptionsFor({ ...base, footerTemplate: '<i>f</i>' }),
    ).toMatchObject({
      headerTemplate: '<span></span>',
      footerTemplate: '<i>f</i>',
    });
  });
});

describe('resolvePrintStyle', () => {
  it('answers the default style silently without a directive', () => {
    expect(resolvePrintStyle(null, doc())).toMatchObject({
      ...DEFAULT_PRINT_STYLE,
      pdf: DEFAULT_PDF_OPTIONS,
    });
    expect(resolvePrintStyle({ other: 1 }, doc()).css).toBeUndefined();
    expect(warn).not.toHaveBeenCalled();
  });

  it('loads a registered style with its page options', () => {
    const style = resolvePrintStyle({ print: 'brief' }, doc());
    expect(style).toMatchObject({
      name: 'brief',
      css: 'h1 { color: navy !important; }',
      pdf: {
        format: 'letter',
        margin: { top: '1mm', right: '2mm', bottom: '1mm', left: '2mm' },
        preferCSSPageSize: true,
        printBackground: true,
      },
    });
    expect(style.pdf.displayHeaderFooter).toBeUndefined();
  });

  it('passes header and footer templates to page.pdf()', () => {
    state.printStyles.brief = { css: cssFile, headerTemplate: headerFile };
    expect(resolvePrintStyle({ print: 'brief' }, doc()).pdf).toMatchObject({
      displayHeaderFooter: true,
      headerTemplate: '<span class="title"></span>',
    });
  });

  it.each([
    ['an unregistered name', 'nope'],
    ['a relative path', '../x.css'],
    ['an absolute path', cssFile],
    ['a URL', 'https://example.com/x.css'],
    ['a number', 7],
    ['a list', ['brief']],
    ['null', null],
    ['an inherited property', 'constructor'],
  ])('gives the default style for %s, warning once per file', (_k, name) => {
    const read = vi.spyOn(fs, 'readFileSync');
    const file = doc();
    expect(resolvePrintStyle({ print: name }, file)).toMatchObject(
      DEFAULT_PRINT_STYLE,
    );
    resolvePrintStyle({ print: name }, file);
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0][0]).toContain(file);
    expect(read).not.toHaveBeenCalled();
    read.mockRestore();
  });

  it('warns again for the same name in another file', () => {
    resolvePrintStyle({ print: 'nope' }, doc());
    resolvePrintStyle({ print: 'nope' }, doc());
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('gives the default style when a style fails to load, logging once', () => {
    expect(resolvePrintStyle({ print: 'broken' }, doc())).toMatchObject(
      DEFAULT_PRINT_STYLE,
    );
    resolvePrintStyle({ print: 'broken' }, doc());
    expect(error).toHaveBeenCalledOnce();
    expect(error.mock.calls[0][0]).toContain('"broken" failed to load');
  });

  it('logs a failure again after the style has loaded in between', () => {
    state.printStyles.flaky = { css: path.join(tmpDir, 'flaky.css') };
    resolvePrintStyle({ print: 'flaky' }, doc());
    fs.writeFileSync(path.join(tmpDir, 'flaky.css'), 'p {}');
    expect(resolvePrintStyle({ print: 'flaky' }, doc()).name).toBe('flaky');
    fs.rmSync(path.join(tmpDir, 'flaky.css'));
    resolvePrintStyle({ print: 'flaky' }, doc());
    expect(error).toHaveBeenCalledTimes(2);
  });

  it('uses styles added by a config reload', () => {
    expect(resolvePrintStyle({ print: 'late' }, doc()).name).toBe('default');
    state.printStyles.late = { css: cssFile };
    expect(resolvePrintStyle({ print: 'late' }, doc()).name).toBe('late');
  });
});
