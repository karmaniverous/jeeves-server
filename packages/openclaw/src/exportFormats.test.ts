import { describe, expect, it } from 'vitest';

import {
  exportRoutesOf,
  exportUrlOf,
  unavailableFormatMessage,
} from './exportFormats.js';

describe('exportRoutesOf', () => {
  it('takes each format and its route from the export links', () => {
    expect([
      ...exportRoutesOf(
        [
          { format: 'svg', url: '/api/mermaid-export/j/d.mmd?format=svg' },
          { format: 'pdf', url: '/api/mermaid-export/j/d.mmd?format=pdf' },
          { format: 'svg', url: '/api/other/j/d.mmd?format=svg' },
          { format: 'odd', url: 'https://elsewhere/x' },
        ],
        false,
      ),
    ]).toEqual([
      ['svg', '/api/mermaid-export/'],
      ['pdf', '/api/mermaid-export/'],
    ]);
  });

  it('adds tar beside a directory zip only', () => {
    const zip = [{ format: 'zip', url: '/api/export/j/docs?format=zip' }];
    expect([...exportRoutesOf(zip, true).keys()]).toEqual(['zip', 'tar']);
    expect([...exportRoutesOf(zip, false).keys()]).toEqual(['zip']);
    expect([...exportRoutesOf(undefined, true).keys()]).toEqual([]);
  });
});

describe('unavailableFormatMessage', () => {
  it('names the valid formats, or why there are none', () => {
    expect(unavailableFormatMessage('j/a.md', 'zip', ['pdf'], false)).toBe(
      'Format "zip" is not available for j/a.md; use pdf',
    );
    expect(unavailableFormatMessage('j/a.json', 'pdf', [], false)).toMatch(
      /^j\/a\.json has no export formats: .*watcher may be unreachable/,
    );
    expect(unavailableFormatMessage('j/docs', 'zip', [], true)).toMatch(
      /insiders only$/,
    );
  });
});

describe('exportUrlOf', () => {
  it('moves a page URL onto the route, keeping its query and dropping the fragment', () => {
    expect(
      exportUrlOf(
        'http://h.test/browse/j/a%20b.md?k=out#top',
        '/api/export/',
        'pdf',
      ),
    ).toBe('http://h.test/api/export/j/a%20b.md?k=out&format=pdf');
    expect(
      exportUrlOf(
        'http://h.test/browse/j/d.mmd',
        '/api/mermaid-export/',
        'png',
      ),
    ).toBe('http://h.test/api/mermaid-export/j/d.mmd?format=png');
  });
});
