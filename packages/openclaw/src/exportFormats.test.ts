import { describe, expect, it } from 'vitest';

import {
  exportRoutesOf,
  routeFor,
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
          // Not a route the SDK's toExportUrl takes: dropped, not an error later.
          { format: 'png', url: '/api/Mermaid_Export/j/d.mmd?format=png' },
        ],
        false,
      ),
    ]).toEqual([
      ['svg', '/api/mermaid-export/'],
      ['pdf', '/api/mermaid-export/'],
    ]);
  });

  it('drops formats the tool does not accept (a PlantUML jar lists eps)', () => {
    const routes = exportRoutesOf(
      ['svg', 'png', 'pdf', 'eps'].map((format) => ({
        format,
        url: `/api/plantuml-export/j/d.puml?format=${format}`,
      })),
      false,
    );
    expect([...routes.keys()]).toEqual(['svg', 'png', 'pdf']);
    expect(
      unavailableFormatMessage('j/d.puml', 'eps', [...routes.keys()], false),
    ).toBe('Format "eps" is not available for j/d.puml; use svg, png, pdf');
  });

  it('adds tar beside a directory zip only', () => {
    const zip = [{ format: 'zip', url: '/api/export/j/docs?format=zip' }];
    expect([...exportRoutesOf(zip, true).keys()]).toEqual(['zip', 'tar']);
    expect([...exportRoutesOf(zip, false).keys()]).toEqual(['zip']);
    expect([...exportRoutesOf(undefined, true).keys()]).toEqual([]);
  });
});

describe('routeFor', () => {
  it('finds an offered format, and nothing for one not offered or unknown', () => {
    const routes = exportRoutesOf(
      [{ format: 'svg', url: '/api/mermaid-export/j/d.mmd?format=svg' }],
      false,
    );
    expect(routeFor(routes, 'svg')).toEqual({
      format: 'svg',
      route: '/api/mermaid-export/',
    });
    expect(routeFor(routes, 'png')).toBeUndefined();
    expect(routeFor(routes, 'eps')).toBeUndefined();
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
