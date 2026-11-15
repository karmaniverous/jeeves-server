import { describe, expect, it } from 'vitest';

import type { SearchFacet, SearchResult } from './apiTypes';
import { buildChips } from './resultChips';

const facet = (
  field: string,
  uiHint: string,
  values: string[] = [],
): SearchFacet => ({ field, type: 'string', uiHint, values, rules: [] });

const result = (metadata: Record<string, unknown>) =>
  ({ metadata }) as unknown as SearchResult;

describe('buildChips', () => {
  it('chips facet-connected metadata, lowest cardinality first, free text last', () => {
    const chips = buildChips(
      result({
        file_path: 'j/a.md',
        title: 'Plan',
        tags: ['x', '', 'null', 'y'],
        kind: 'doc',
        unknown: 'skip',
      }),
      [
        facet('file_path', 'select', ['j/a.md']),
        facet('title', 'text'),
        facet('tags', 'multiselect', ['x', 'y', 'z']),
        facet('kind', 'select', ['doc']),
      ],
    );
    expect(chips.map((c) => `${c.label}=${c.value}`)).toEqual([
      'Kind=doc',
      'Tags=x',
      'Tags=y',
      'Title=Plan',
    ]);
    expect(chips[0]).toMatchObject({ field: 'kind', cardinality: 1 });
    expect(chips[3]?.cardinality).toBe(Infinity);
  });

  it('chips nothing without metadata', () => {
    expect(buildChips({} as SearchResult, [facet('kind', 'select')])).toEqual(
      [],
    );
  });
});
