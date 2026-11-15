import { describe, expect, it } from 'vitest';

import { getDownloadItems, showClearCache } from './downloadItems';

const md = { fileName: 'a.md', type: 'markdown' };

describe('getDownloadItems', () => {
  it('offers ZIP and Tar for directories to insiders only', () => {
    expect(
      getDownloadItems('r/docs', null, true, true).map((i) => i.label),
    ).toEqual(['ZIP', 'Tar']);
    expect(getDownloadItems('r/docs', null, true, false)).toEqual([]);
  });

  it('offers file formats to insiders and outsiders alike', () => {
    const labels = ['Raw', 'PDF', 'DOCX'];
    expect(
      getDownloadItems('r/a.md', md, false, true).map((i) => i.label),
    ).toEqual(labels);
    expect(
      getDownloadItems('r/a.md', md, false, false).map((i) => i.label),
    ).toEqual(labels);
  });

  it('names each download from the request (<base>.<format>, <dir>.<archive>)', () => {
    expect(getDownloadItems('r/docs', null, true, true)).toEqual([
      {
        label: 'ZIP',
        request: { entry: 'export', format: 'zip' },
        filename: 'docs.zip',
      },
      {
        label: 'Tar',
        request: { entry: 'export', format: 'tar' },
        filename: 'docs.tar',
      },
    ]);
    expect(getDownloadItems('r/a.md', md, false, true)).toEqual([
      { label: 'Raw', request: { entry: 'raw' }, filename: 'a.md' },
      {
        label: 'PDF',
        request: { entry: 'export', format: 'pdf' },
        filename: 'a.pdf',
      },
      {
        label: 'DOCX',
        request: { entry: 'export', format: 'docx' },
        filename: 'a.docx',
      },
    ]);
  });

  it('offers diagram exports for Mermaid and PlantUML sources', () => {
    const names = (fileName: string, type: string) =>
      getDownloadItems('r/x', { fileName, type }, false, false).map((i) => [
        i.label,
        i.request,
        i.filename,
      ]);
    expect(names('d.mmd', 'mermaid')).toEqual([
      ['Raw', { entry: 'raw' }, 'd.mmd'],
      ['SVG', { entry: 'exportMermaid', format: 'svg' }, 'd.svg'],
      ['PNG', { entry: 'exportMermaid', format: 'png' }, 'd.png'],
      ['PDF', { entry: 'exportMermaid', format: 'pdf' }, 'd.pdf'],
    ]);
    expect(names('d.pu', '.pu').map(([label]) => label)).toEqual([
      'Raw',
      'SVG',
      'PNG',
      'PDF',
      'EPS',
    ]);
  });
});

describe('showClearCache', () => {
  it('is shown to insiders for files only', () => {
    expect(showClearCache(false, true)).toBe(true);
    expect(showClearCache(true, true)).toBe(false);
    expect(showClearCache(false, false)).toBe(false);
  });
});
