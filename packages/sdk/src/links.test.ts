/**
 * The link helpers and the query helper under them: share credentials added without disturbing what a URL carries, and page URLs mapped onto the raw and export routes.
 */

import { describe, expect, it } from 'vitest';

import { toExportUrl, toRawUrl, withShareCredential } from './links.js';
import { appendQuery, splitUrl } from './query.js';
import type { ServerError } from './ServerError.js';

const PAGE = 'https://jeeves.test/browse/j/docs/My%20Doc.md';

/** The error a call throws. */
const thrown = (call: () => unknown): ServerError => {
  try {
    call();
  } catch (error) {
    return error as ServerError;
  }
  throw new Error('did not throw');
};

describe('appendQuery', () => {
  it('adds parameters after the existing query, before the fragment', () => {
    expect(appendQuery('/a?x=1#h', [['k', 'a b']])).toBe('/a?x=1&k=a%20b#h');
    expect(
      appendQuery('/a', [
        ['k', '1'],
        ['exp', '2'],
      ]),
    ).toBe('/a?k=1&exp=2');
    expect(appendQuery('/a?', [['k', '1']])).toBe('/a?k=1');
  });

  it('keeps parameters already present and their encoding', () => {
    const url = '/a?s=x+y%2Fz&k=mine';
    expect(
      appendQuery(url, [
        ['k', 'other'],
        ['d', '2'],
      ]),
    ).toBe('/a?s=x+y%2Fz&k=mine&d=2');
    expect(appendQuery(url, [['k', 'other']])).toBe(url);
  });

  it('splits absolute and relative URLs as written', () => {
    expect(splitUrl('http://h:1/p%20q?a=1#f')).toEqual({
      base: 'http://h:1/p%20q',
      path: '/p%20q',
      query: '?a=1',
      fragment: '#f',
    });
    expect(splitUrl('/p')).toEqual({
      base: '/p',
      path: '/p',
      query: '',
      fragment: '',
    });
  });
});

describe('withShareCredential', () => {
  it('adds k, exp and the deep-share fields in order', () => {
    expect(
      withShareCredential(PAGE, {
        k: 'key',
        exp: '99',
        d: '2',
        dirs: '1',
        s: 'stack+',
      }),
    ).toBe(`${PAGE}?k=key&exp=99&d=2&dirs=1&s=stack%2B`);
  });

  it('keeps an existing query such as download', () => {
    expect(
      withShareCredential('/api/raw/j/a.pdf?download=1', { k: 'key' }),
    ).toBe('/api/raw/j/a.pdf?download=1&k=key');
  });
});

describe('toRawUrl', () => {
  it('maps /browse/ onto /api/raw/, keeping the query and dropping the fragment', () => {
    expect(toRawUrl(`${PAGE}?k=key&exp=9#heading`)).toBe(
      'https://jeeves.test/api/raw/j/docs/My%20Doc.md?k=key&exp=9',
    );
    expect(toRawUrl('/browse/j/a.md')).toBe('/api/raw/j/a.md');
  });

  it('refuses a URL that is not a page URL', () => {
    for (const url of [
      'https://jeeves.test/raw/j/a.md',
      '/browse/',
      '/x/browse/a',
    ])
      expect(thrown(() => toRawUrl(url))).toMatchObject({
        code: 'invalid_options',
        status: 0,
        message: 'pageUrl must address a /browse/<path> page',
      });
  });
});

describe('toExportUrl', () => {
  it('addresses /api/export/ for documents and directories', () => {
    expect(toExportUrl(`${PAGE}?k=key#top`, 'docx')).toBe(
      'https://jeeves.test/api/export/j/docs/My%20Doc.md?k=key&format=docx',
    );
    expect(toExportUrl('/browse/j/docs', 'zip')).toBe(
      '/api/export/j/docs?format=zip',
    );
    expect(toExportUrl('/browse/j/docs/', 'tar')).toBe(
      '/api/export/j/docs/?format=tar',
    );
  });

  it('addresses the diagram routes for svg and png of diagram sources', () => {
    expect(toExportUrl('/browse/j/flow.MMD?k=1', 'svg')).toBe(
      '/api/mermaid-export/j/flow.MMD?k=1&format=svg',
    );
    expect(toExportUrl('/browse/j/seq.puml', 'png')).toBe(
      '/api/plantuml-export/j/seq.puml?format=png',
    );
    expect(toExportUrl('/browse/j/seq.plantuml', 'svg')).toBe(
      '/api/plantuml-export/j/seq.plantuml?format=svg',
    );
  });

  it('addresses the Mermaid route for pdf of a Mermaid source', () => {
    expect(toExportUrl('/browse/j/flow.mmd?k=1#x', 'pdf')).toBe(
      '/api/mermaid-export/j/flow.mmd?k=1&format=pdf',
    );
  });

  it('refuses a format the path cannot be exported in, naming the valid ones', () => {
    expect(
      thrown(() => toExportUrl('/browse/j/flow.mmd', 'docx')),
    ).toMatchObject({
      code: 'invalid_options',
      message: 'Format "docx" is not available for flow.mmd; use svg, png, pdf',
    });
    expect(
      thrown(() => toExportUrl('/browse/j/seq.puml', 'pdf')),
    ).toMatchObject({
      code: 'invalid_options',
      message: 'Format "pdf" is not available for seq.puml; use svg, png',
    });
    expect(thrown(() => toExportUrl('/browse/j/a.md', 'png'))).toMatchObject({
      code: 'invalid_options',
      message:
        'Format "png" is not available for a.md; use pdf, docx, zip, tar',
    });
  });
});

describe('toExportUrl with a route', () => {
  it.each([
    ['/api/export/', 'pdf', `${PAGE}?k=key&exp=9#top`],
    [
      '/api/mermaid-export/',
      'pdf',
      'https://jeeves.test/browse/j/d.mmd?k=key&exp=9',
    ],
    [
      '/api/plantuml-export/',
      'pdf',
      'https://jeeves.test/browse/j/d.puml?k=key&exp=9#f',
    ],
  ] as const)(
    'moves the page URL onto %s, keeping the query and dropping the fragment',
    (route, format, pageUrl) => {
      const path = pageUrl.slice(
        'https://jeeves.test/browse/'.length,
        pageUrl.indexOf('?'),
      );
      expect(toExportUrl(pageUrl, format, { route })).toBe(
        `https://jeeves.test${route}${path}?k=key&exp=9&format=${format}`,
      );
    },
  );

  it('skips the extension table', () => {
    // A file the watcher renders as Markdown, and a PlantUML source with a jar.
    expect(
      toExportUrl('/browse/j/data.json', 'docx', { route: '/api/export/' }),
    ).toBe('/api/export/j/data.json?format=docx');
    expect(
      toExportUrl('/browse/j/seq.puml?download=1', 'pdf', {
        route: '/api/plantuml-export/',
      }),
    ).toBe('/api/plantuml-export/j/seq.puml?download=1&format=pdf');
  });

  it.each([
    'api/export/',
    '/api/export',
    '/api/',
    '/api/Export/',
    '/api/export/j/a.md?format=pdf',
    '/base/api/export/',
    'https://jeeves.test/api/export/',
  ])('refuses the route %s', (route) => {
    expect(
      thrown(() => toExportUrl('/browse/j/a.md', 'pdf', { route })),
    ).toMatchObject({
      code: 'invalid_options',
      status: 0,
      message: `route must be an /api/<route>/ prefix such as /api/export/; got "${route}"`,
    });
  });

  it('still refuses a URL that is not a page URL', () => {
    expect(
      thrown(() =>
        toExportUrl('/x/browse/j/a.md', 'pdf', { route: '/api/export/' }),
      ),
    ).toMatchObject({
      code: 'invalid_options',
      message: 'pageUrl must address a /browse/<path> page',
    });
  });
});
