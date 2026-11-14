import { describe, expect, it } from 'vitest';

import type { SearchFacet } from './apiTypes';
import {
  buildSearchFilter,
  cleanFacetValues,
  formatFieldLabel,
  isFreeTextFacet,
  partitionFacets,
} from './searchFacets';

const facet = (
  field: string,
  uiHint: string,
  values: string[] = [],
): SearchFacet => ({ field, type: 'string', uiHint, values, rules: [] });

describe('searchFacets', () => {
  it('drops empty, object-to-string and unresolved-template values', () => {
    expect(
      cleanFacetValues(['a', '', '  ', '[object Object]', '${x}', 'b']),
    ).toEqual(['a', 'b']);
  });

  it('labels fields in title case', () => {
    expect(formatFieldLabel('doc_type')).toBe('Doc Type');
  });

  it('tells free-text facets from enumerated ones', () => {
    expect(isFreeTextFacet({ uiHint: 'text' })).toBe(true);
    expect(isFreeTextFacet({ uiHint: 'number' })).toBe(true);
    expect(isFreeTextFacet({ uiHint: 'select' })).toBe(false);
  });

  it('partitions the manifest into clean facets and garbage', () => {
    const { cleaned, garbage } = partitionFacets([
      facet('hidden', 'hidden', ['x']),
      facet('title', 'text', ['ignored']),
      facet('kind', 'select', ['a', '', '${t}', 'b']),
      facet('bad', 'select', ['[object Object]']),
      facet('none', 'select'),
    ]);
    expect(cleaned).toEqual([
      facet('title', 'text'),
      facet('kind', 'select', ['a', 'b']),
    ]);
    expect(garbage).toEqual([
      {
        field: 'kind',
        removed: ['"" (empty)', '"${t}" (unresolved-template)'],
        reason: 'empty, unresolved-template',
      },
      {
        field: 'bad',
        removed: ['"[object Object]" (object-to-string)'],
        reason: 'object-to-string',
      },
      {
        field: 'bad',
        removed: ['(all values filtered)'],
        reason: 'no valid values remain',
      },
      { field: 'none', removed: ['(no values)'], reason: 'empty values array' },
    ]);
  });

  it('builds a filter from selections and non-blank text', () => {
    expect(buildSearchFilter({}, {})).toBeUndefined();
    expect(
      buildSearchFilter(
        { kind: new Set(), tag: new Set(['a', 'b']) },
        {
          title: '  plan ',
          body: ' ',
        },
      ),
    ).toEqual({
      must: [
        { key: 'tag', match: { any: ['a', 'b'] } },
        { key: 'title', match: { text: 'plan' } },
      ],
    });
  });
});
