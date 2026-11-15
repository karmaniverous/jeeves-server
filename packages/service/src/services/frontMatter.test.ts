/**
 * Tests for front matter parsing: the `jeeves` namespace (Decision 2)
 * removed from display with the rest's comments and order kept, non-mapping
 * `jeeves`, empty remainder, invalid YAML and line counts.
 *
 * @packageDocumentation
 */

import { describe, expect, it } from 'vitest';

import { parseFrontMatter } from './frontMatter.js';

describe('parseFrontMatter', () => {
  it('passes a document without front matter through', () => {
    const { frontMatter, body } = parseFrontMatter('# A\n---\nx: 1\n---\n');
    expect(body).toBe('# A\n---\nx: 1\n---\n');
    expect(frontMatter).toEqual({
      raw: null,
      lineCount: 0,
      data: null,
      directives: null,
      display: null,
      jeevesIgnored: false,
    });
  });

  it('shows front matter without jeeves exactly as written', () => {
    const raw = 'title:   Spaced   # note\ntags: [a, b]';
    const { frontMatter, body } = parseFrontMatter(`---\n${raw}\n---\n# B\n`);
    expect(body).toBe('# B\n');
    expect(frontMatter).toMatchObject({
      raw,
      lineCount: 4,
      data: { title: 'Spaced', tags: ['a', 'b'] },
      directives: null,
      display: raw,
      jeevesIgnored: false,
    });
  });

  it('removes a jeeves mapping from display, keeping comments and order', () => {
    const src = [
      '---',
      '# Lead comment',
      'zeta: 1 # why zeta',
      'jeeves:',
      '  print: bca-brief # style',
      '  future: { a: 1 }',
      'alpha: >-',
      '  a long folded value that must not be re-wrapped by the serializer at eighty columns',
      '---',
      'Body',
    ].join('\n');
    const { frontMatter, body } = parseFrontMatter(src);
    expect(body).toBe('Body');
    expect(frontMatter.directives).toEqual({
      print: 'bca-brief',
      future: { a: 1 },
    });
    expect(frontMatter.data).toMatchObject({ zeta: 1 });
    expect(frontMatter.lineCount).toBe(9);
    expect(frontMatter.display).toBe(
      [
        '# Lead comment',
        'zeta: 1 # why zeta',
        'alpha: >-',
        '  a long folded value that must not be re-wrapped by the serializer at eighty columns',
      ].join('\n'),
    );
  });

  it('shows no block when jeeves was the only key', () => {
    const { frontMatter } = parseFrontMatter('---\njeeves:\n  print: x\n---\n');
    expect(frontMatter.display).toBeNull();
    expect(frontMatter.directives).toEqual({ print: 'x' });
  });

  it.each([
    ['a string', 'jeeves: bca-brief'],
    ['a list', 'jeeves:\n  - print'],
    ['null', 'jeeves:'],
  ])('shows a jeeves that is %s as ordinary data', (_kind, raw) => {
    const { frontMatter } = parseFrontMatter(`---\n${raw}\n---\n`);
    expect(frontMatter).toMatchObject({
      display: raw,
      directives: null,
      jeevesIgnored: true,
    });
    expect(frontMatter.data).toHaveProperty('jeeves');
  });

  it.each([
    ['invalid YAML', 'title: [unclosed\njeeves:\n  print: x'],
    ['duplicate keys', 'jeeves:\n  print: x\njeeves:\n  print: y'],
    ['a list, not a mapping', '- jeeves\n- title'],
  ])('shows %s raw, with no data or directives', (_kind, raw) => {
    const { frontMatter } = parseFrontMatter(`---\n${raw}\n---\nBody`);
    expect(frontMatter).toMatchObject({
      raw,
      display: raw,
      data: null,
      directives: null,
      jeevesIgnored: false,
    });
  });

  it('counts CRLF lines and reads CRLF YAML', () => {
    const { frontMatter, body } = parseFrontMatter(
      '---\r\na: 1\r\njeeves:\r\n  print: x\r\n---\r\n# H',
    );
    expect(body).toBe('# H');
    expect(frontMatter.lineCount).toBe(5);
    expect(frontMatter.directives).toEqual({ print: 'x' });
    expect(frontMatter.display).toBe('a: 1');
  });
});
