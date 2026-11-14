import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { inlineAssets } from './printStyleAssets.js';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'print-assets-'));
const assets = path.join(tmpDir, 'assets');
const logo = path.join(assets, 'img', 'logo.png');
const outside = path.join(tmpDir, 'secret.png');

const LOGO_URI = `data:image/png;base64,${Buffer.from('PNG').toString('base64')}`;

fs.mkdirSync(path.dirname(logo), { recursive: true });
fs.writeFileSync(logo, 'PNG');
fs.writeFileSync(path.join(assets, 'font.woff2'), 'W2');
fs.writeFileSync(outside, 'SECRET');

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const warn = vi.fn();
beforeEach(() => {
  warn.mockReset();
});

const css = (text: string, dir: string | undefined = assets) =>
  inlineAssets(text, 'css', dir, warn);
const html = (text: string, dir: string | undefined = assets) =>
  inlineAssets(text, 'html', dir, warn);

describe('inlineAssets: CSS url()', () => {
  it.each([
    ['unquoted', 'url(img/logo.png)'],
    ['double-quoted', 'url("img/logo.png")'],
    ['single-quoted', "url( 'img/logo.png' )"],
    ['dot-relative', 'url(./img/logo.png)'],
    ['with a query', 'url(img/logo.png?v=2)'],
  ])('inlines an %s file inside the assets directory', (_kind, ref) => {
    const out = css(`a { background: ${ref}; }`);
    expect(out.text).toBe(`a { background: url("${LOGO_URI}"); }`);
    expect(out.read.map((f) => f.path)).toEqual([logo]);
    expect(warn).not.toHaveBeenCalled();
  });

  it('types fonts by extension', () => {
    expect(css('src: url(font.woff2)').text).toBe(
      `src: url("data:font/woff2;base64,${Buffer.from('W2').toString('base64')}")`,
    );
  });

  it.each([
    ['outside the directory', 'url(../secret.png)'],
    ['an absolute path', `url("${outside.replaceAll('\\', '/')}")`],
    ['remote', 'url(https://example.com/logo.png)'],
    ['protocol-relative', 'url(//example.com/logo.png)'],
    ['a file URL', 'url(file:///etc/passwd)'],
    ['missing', 'url(img/none.png)'],
    ['the directory itself', 'url(.)'],
  ])('removes a reference %s and logs it', (_kind, ref) => {
    const out = css(`a { background: ${ref}; }`);
    expect(out.text).toBe('a { background: none; }');
    expect(out.read).toEqual([]);
    expect(warn).toHaveBeenCalledOnce();
  });

  it('removes every file reference without an assets directory', () => {
    expect(
      inlineAssets('a { b: url(img/logo.png); }', 'css', undefined, warn).text,
    ).toBe('a { b: none; }');
    expect(warn).toHaveBeenCalledOnce();
  });

  it('keeps data URIs and fragments', () => {
    const text = 'a { b: url(data:image/png;base64,AA); c: url(#f); }';
    expect(css(text).text).toBe(text);
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('inlineAssets: template src', () => {
  it('inlines src="..." and src=\'...\' inside the assets directory', () => {
    const out = html(`<img src="img/logo.png"><img src='img/logo.png'>`);
    expect(out.text).toBe(`<img src="${LOGO_URI}"><img src="${LOGO_URI}">`);
  });

  it('removes a remote or outside src and logs it', () => {
    const out = html(
      '<img class="l" src="https://x.test/a.png"><img src="../secret.png">',
    );
    expect(out.text).toBe('<img class="l"><img>');
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('leaves url() alone in templates and src in CSS', () => {
    expect(html('<div style="x: url(a.png)"></div>').text).toBe(
      '<div style="x: url(a.png)"></div>',
    );
    expect(css('/* src="a.png" */').text).toBe('/* src="a.png" */');
  });
});
