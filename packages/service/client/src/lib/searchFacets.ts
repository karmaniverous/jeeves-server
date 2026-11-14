/**
 * Search facet helpers: cleaning the facets manifest, labelling fields and
 * building the search filter from the selected facet values.
 */
import type { SearchFacet } from './apiTypes';

/** Enumerated facets with ≤ this many values render as chips; above → searchable dropdown */
export const CHIP_THRESHOLD = 8;

/** Facet values removed while cleaning the manifest, and why. */
export interface GarbageEntry {
  field: string;
  removed: string[];
  reason: string;
}

/** Whether a facet takes free text (text or number) rather than enumerated values. */
export const isFreeTextFacet = (facet: Pick<SearchFacet, 'uiHint'>): boolean =>
  facet.uiHint === 'text' || facet.uiHint === 'number';

/** Why a facet value is garbage, or undefined when it is a good value. */
function garbageReason(value: string): string | undefined {
  const s = String(value ?? '');
  if (!s || !s.trim()) return 'empty';
  if (s.includes('[object Object]')) return 'object-to-string';
  if (/^\$\{.*\}$/.test(s)) return 'unresolved-template';
  return undefined;
}

/** Filter out empty, garbage, and unresolved template values */
export function cleanFacetValues(values: string[]): string[] {
  return values.filter((v) => garbageReason(v) === undefined);
}

/** `some_field` → `Some Field`. */
export function formatFieldLabel(field: string): string {
  return field.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Split the facets manifest into the facets to offer (hidden ones dropped,
 * enumerated values cleaned) and the garbage found along the way.
 *
 * @param facets - The facets of the manifest.
 * @returns The clean facets and the garbage entries.
 */
export function partitionFacets(facets: SearchFacet[]): {
  cleaned: SearchFacet[];
  garbage: GarbageEntry[];
} {
  const cleaned: SearchFacet[] = [];
  const garbage: GarbageEntry[] = [];
  for (const f of facets) {
    if (f.uiHint === 'hidden') continue;
    // Text/number facets use free-text input — values array is irrelevant
    if (isFreeTextFacet(f)) {
      cleaned.push({ ...f, values: [] });
      continue;
    }
    const goodValues = cleanFacetValues(f.values);
    const badValues = f.values.flatMap((value) => {
      const reason = garbageReason(value);
      return reason === undefined ? [] : [{ value, reason }];
    });
    if (badValues.length > 0) {
      garbage.push({
        field: f.field,
        removed: badValues.map(
          ({ value, reason }) => `${JSON.stringify(value)} (${reason})`,
        ),
        reason: [...new Set(badValues.map(({ reason }) => reason))].join(', '),
      });
    }
    if (goodValues.length > 0) {
      cleaned.push({ ...f, values: goodValues });
    } else {
      // All values were garbage — include facet with empty values but log it
      garbage.push({
        field: f.field,
        removed:
          badValues.length > 0 ? ['(all values filtered)'] : ['(no values)'],
        reason:
          badValues.length > 0
            ? 'no valid values remain'
            : 'empty values array',
      });
    }
  }
  return { cleaned, garbage };
}

/** A search filter: every clause must match. */
export type SearchFilter = { must: Record<string, unknown>[] };

/**
 * Build the search filter from the selected facet values and free-text
 * inputs: one `match.any` clause per field with a selection, one
 * `match.text` clause per non-blank text input.
 *
 * @returns The filter, or undefined when nothing is selected.
 */
export function buildSearchFilter(
  selections: Record<string, Set<string>>,
  textInputs: Record<string, string>,
): SearchFilter | undefined {
  const must: Record<string, unknown>[] = [];
  for (const [field, selected] of Object.entries(selections)) {
    if (selected.size > 0) {
      must.push({ key: field, match: { any: [...selected] } });
    }
  }
  for (const [field, text] of Object.entries(textInputs)) {
    if (text.trim()) {
      must.push({ key: field, match: { text: text.trim() } });
    }
  }
  return must.length > 0 ? { must } : undefined;
}
