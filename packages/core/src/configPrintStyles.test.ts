import { describe, expect, it } from 'vitest';

import { isAbsolutePath, printStylesSchema } from './configPrintStyles.js';
import { jeevesConfigSchema } from './schema.js';

const minimal = {
  chromePath: '/usr/bin/chromium',
  auth: { modes: ['keys'] },
  keys: { primary: 'a'.repeat(64) },
};

const css = '/opt/styles/brief.css';

/** Whether `printStyles` parses inside a full config. */
const parses = (printStyles: unknown): boolean =>
  jeevesConfigSchema.safeParse({ ...minimal, printStyles }).success;

describe('isAbsolutePath', () => {
  it.each([
    ['/opt/a.css', true],
    ['C:\\styles\\a.css', true],
    ['d:/styles/a.css', true],
    ['\\\\server\\share\\a.css', true],
    ['styles/a.css', false],
    ['./a.css', false],
    ['C:a.css', false],
  ])('%s → %s', (p, expected) => {
    expect(isAbsolutePath(p)).toBe(expected);
  });
});

describe('printStyles config', () => {
  it('is optional', () => {
    expect(jeevesConfigSchema.parse(minimal).printStyles).toBeUndefined();
  });

  it('accepts a full style', () => {
    const style = {
      css,
      page: { format: 'Letter', margin: '14mm 14mm 16mm 14mm' },
      headerTemplate: 'C:\\styles\\brief.header.html',
      footerTemplate: '/opt/styles/brief.footer.html',
      assets: '/opt/styles/assets',
    };
    expect(
      jeevesConfigSchema.parse({
        ...minimal,
        printStyles: { 'bca-brief': style },
      }).printStyles,
    ).toEqual({ 'bca-brief': style });
  });

  it('accepts width and height instead of a format', () => {
    expect(parses({ a: { css, page: { width: '8.5in', height: 1100 } } })).toBe(
      true,
    );
  });

  it.each([
    ['an upper-case name', { Brief: { css } }],
    ['a name starting with a hyphen', { '-brief': { css } }],
    ['a name with a dot', { 'a.b': { css } }],
    ['a missing css', { a: {} }],
    ['a relative css path', { a: { css: 'styles/a.css' } }],
    ['a relative template path', { a: { css, footerTemplate: 'f.html' } }],
    ['a relative assets path', { a: { css, assets: 'assets' } }],
    ['an unknown format', { a: { css, page: { format: 'A9' } } }],
    [
      'format with a width',
      { a: { css, page: { format: 'A4', width: 1, height: 1 } } },
    ],
    ['width without height', { a: { css, page: { width: '8in' } } }],
    ['height without width', { a: { css, page: { height: '8in' } } }],
    ['five margins', { a: { css, page: { margin: '1 2 3 4 5' } } }],
    ['an empty margin', { a: { css, page: { margin: ' ' } } }],
  ])('rejects %s', (_kind, printStyles) => {
    expect(parses(printStyles)).toBe(false);
  });

  it('names the offending path in the error', () => {
    const result = printStylesSchema.safeParse({ a: { css: 'a.css' } });
    expect(result.error?.issues[0]).toMatchObject({
      path: ['a', 'css'],
      message: 'css must be an absolute path',
    });
  });

  it('accepts a format in any case', () => {
    expect(parses({ a: { css, page: { format: 'a4' } } })).toBe(true);
  });
});
