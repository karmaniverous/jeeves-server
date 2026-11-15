/**
 * Metadata chips for a search result: its facet-connected metadata values,
 * lowest-cardinality facets first.
 */
import type { SearchFacet, SearchResult } from './apiTypes';
import { formatFieldLabel, isFreeTextFacet } from './searchFacets';

/** Internal fields to exclude from metadata chips */
const META_INTERNAL_KEYS = new Set([
  'file_path',
  'chunk_text',
  'chunk_index',
  'total_chunks',
  'content_hash',
  'embedded_at',
]);

/** One metadata chip of a search result. */
export interface ResultChip {
  field: string;
  label: string;
  value: string;
  cardinality: number;
}

/** Build sorted chip entries from result metadata × facets. Lowest cardinality first; text/number last. */
export function buildChips(
  result: SearchResult,
  facets: SearchFacet[],
): ResultChip[] {
  const meta = result.metadata ?? {};
  const chips: ResultChip[] = [];
  const facetMap = new Map(facets.map((f) => [f.field, f]));

  for (const [key, raw] of Object.entries(meta)) {
    if (META_INTERNAL_KEYS.has(key)) continue;
    const facet = facetMap.get(key);
    if (!facet) continue; // only show facet-connected props

    const values = Array.isArray(raw) ? raw.map(String) : [String(raw)];
    const cardinality = isFreeTextFacet(facet) ? Infinity : facet.values.length;

    for (const v of values) {
      if (!v || v === 'undefined' || v === 'null') continue;
      chips.push({
        field: key,
        label: formatFieldLabel(key),
        value: v,
        cardinality,
      });
    }
  }

  chips.sort((a, b) => a.cardinality - b.cardinality);
  return chips;
}
