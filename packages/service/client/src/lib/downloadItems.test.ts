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
    expect(getDownloadItems('r/a.md', md, false, true).map((i) => i.label)).toEqual(
      labels,
    );
    expect(
      getDownloadItems('r/a.md', md, false, false).map((i) => i.label),
    ).toEqual(labels);
  });
});

describe('showClearCache', () => {
  it('is shown to insiders for files only', () => {
    expect(showClearCache(false, true)).toBe(true);
    expect(showClearCache(true, true)).toBe(false);
    expect(showClearCache(false, false)).toBe(false);
  });
});
