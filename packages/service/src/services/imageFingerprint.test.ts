// @vitest-environment node
/**
 * Tests for finding the local images a Markdown document references.
 */

import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { urlPathToFs } from '../util/platform.js';
import { imageFingerprint, localImagePaths } from './imageFingerprint.js';

const docDir = path.resolve('/docs/notes');
const docPath = path.join(docDir, 'doc.md');
const roots = [{ id: 'j', label: 'j', fsPath: path.resolve('/data/j') }];

const paths = (source: string) => localImagePaths(source, docPath, roots);

describe('localImagePaths', () => {
  it('resolves relative Markdown images beside the document', () => {
    expect(paths('![a](img/a.png)\n\n![b](../b.png "Title")')).toEqual(
      [path.join(docDir, 'img', 'a.png'), path.resolve('/docs/b.png')].sort(),
    );
  });

  it('finds images inside links, tables and HTML', () => {
    const source = [
      '[![badge](badge.png)](https://example.com)',
      '',
      '| x |',
      '| - |',
      '| ![t](t.png) |',
      '',
      '<p><img src="block.png" alt=""></p>',
      '',
      'Inline <img src="inline.png"> image.',
    ].join('\n');
    expect(paths(source)).toEqual(
      ['badge.png', 't.png', 'block.png', 'inline.png']
        .map((name) => path.join(docDir, name))
        .sort(),
    );
  });

  it('strips query and fragment and decodes the path', () => {
    expect(paths('![a](my%20chart.png?v=2#top)')).toEqual([
      path.join(docDir, 'my chart.png'),
    ]);
  });

  it('keeps a source that is not valid URI encoding as written', () => {
    expect(paths('![a](100%.png)')).toEqual([path.join(docDir, '100%.png')]);
  });

  it('resolves /path/ and /api/raw/ sources under the roots', () => {
    const expected = urlPathToFs('j/assets/logo.png', roots);
    expect(expected).not.toBeNull();
    expect(
      paths('![a](/path/j/assets/logo.png)\n![b](/api/raw/j/assets/logo.png)'),
    ).toEqual([path.resolve(String(expected))]);
  });

  it('skips remote, data and other absolute sources', () => {
    const source = [
      '![a](https://example.com/a.png)',
      '![b](//cdn.example.com/b.png)',
      '![c](data:image/png;base64,AAAA)',
      '![d](/browse/j/d.png)',
      '![e]()',
    ].join('\n');
    expect(paths(source)).toEqual([]);
  });

  it('lists each image once', () => {
    expect(paths('![a](a.png) ![again](./a.png)')).toEqual([
      path.join(docDir, 'a.png'),
    ]);
  });
});

describe('imageFingerprint', () => {
  it('marks a missing image', () => {
    expect(imageFingerprint('![a](nope.png)', docPath, roots)).toBe(
      `${path.join(docDir, 'nope.png')}\0missing`,
    );
  });

  it('is empty for a document without local images', () => {
    expect(imageFingerprint('# Title', docPath, roots)).toBe('');
  });
});
