import type { SearchFacet } from '@/lib/apiTypes';
import {
  CHIP_THRESHOLD,
  formatFieldLabel,
  isFreeTextFacet,
} from '@/lib/searchFacets';

import { FacetTextInput } from './FacetTextInput';
import { FilterChips } from './FilterChips';
import { SearchableSelect } from './SearchableSelect';

/**
 * One active facet filter, by kind: a text input for free-text facets,
 * chips for few values, a searchable dropdown for many.
 */
export function FacetFilter({
  facet,
  selected,
  text,
  onToggle,
  onTextChange,
  onRemove,
}: {
  facet: SearchFacet;
  selected: Set<string>;
  text: string;
  onToggle: (value: string) => void;
  onTextChange: (text: string) => void;
  onRemove: () => void;
}) {
  const label = formatFieldLabel(facet.field);

  if (isFreeTextFacet(facet)) {
    return (
      <FacetTextInput
        label={label}
        value={text}
        onChange={onTextChange}
        inputType={facet.uiHint === 'number' ? 'number' : 'text'}
        onRemove={onRemove}
      />
    );
  }

  if (facet.values.length <= CHIP_THRESHOLD) {
    return (
      <FilterChips
        label={label}
        values={facet.values}
        selected={selected}
        onToggle={onToggle}
        onRemove={onRemove}
      />
    );
  }

  return (
    <SearchableSelect
      label={label}
      values={facet.values}
      selected={selected}
      onToggle={onToggle}
      multi={facet.uiHint === 'multiselect'}
      onRemove={onRemove}
    />
  );
}
