/**
 * The search modal's facet filters: which facet fields are active, the
 * values selected for enumerated facets and the text typed for free-text
 * ones, and the search filter they make.
 */
import { useCallback, useMemo, useState } from 'react';

import type { SearchFacet } from '@/lib/apiTypes';
import {
  buildSearchFilter,
  isFreeTextFacet,
  type SearchFilter,
} from '@/lib/searchFacets';

/** The facet filter state and its updaters. */
export interface FacetFilters {
  activeFields: Set<string>;
  selections: Record<string, Set<string>>;
  textInputs: Record<string, string>;
  /** The search filter; a new object exactly when selections or text change. */
  filter: SearchFilter | undefined;
  addField: (field: string) => void;
  removeField: (field: string) => void;
  toggleValue: (field: string, value: string) => void;
  setText: (field: string, text: string) => void;
  /** Filter by a result's metadata value: activate the field and select (or type) the value. */
  applyValue: (
    facet: SearchFacet | undefined,
    field: string,
    value: string,
  ) => void;
  reset: () => void;
}

const withValue = (
  prev: Record<string, Set<string>>,
  field: string,
  update: (values: Set<string>) => void,
): Record<string, Set<string>> => {
  const next = new Set(prev[field] ?? new Set<string>());
  update(next);
  return { ...prev, [field]: next };
};

const without = <T>(prev: Record<string, T>, field: string) => {
  const n = { ...prev };
  delete n[field];
  return n;
};

/** Hold the search modal's facet filters. */
export function useFacetFilters(): FacetFilters {
  const [selections, setSelections] = useState<Record<string, Set<string>>>({});
  const [textInputs, setTextInputs] = useState<Record<string, string>>({});
  const [activeFields, setActiveFields] = useState<Set<string>>(new Set());

  const filter = useMemo(
    () => buildSearchFilter(selections, textInputs),
    [selections, textInputs],
  );

  const addField = useCallback((field: string) => {
    setActiveFields((prev) => new Set([...prev, field]));
  }, []);

  const removeField = useCallback((field: string) => {
    setActiveFields((prev) => {
      const n = new Set(prev);
      n.delete(field);
      return n;
    });
    setSelections((prev) => without(prev, field));
    setTextInputs((prev) => without(prev, field));
  }, []);

  const toggleValue = useCallback((field: string, value: string) => {
    setSelections((prev) =>
      withValue(prev, field, (next) => {
        if (next.has(value)) next.delete(value);
        else next.add(value);
      }),
    );
  }, []);

  const setText = useCallback((field: string, text: string) => {
    setTextInputs((prev) => ({ ...prev, [field]: text }));
  }, []);

  const applyValue = useCallback(
    (facet: SearchFacet | undefined, field: string, value: string) => {
      addField(field);
      if (facet && isFreeTextFacet(facet)) setText(field, value);
      else setSelections((prev) => withValue(prev, field, (n) => n.add(value)));
    },
    [addField, setText],
  );

  const reset = useCallback(() => {
    setSelections({});
    setTextInputs({});
    setActiveFields(new Set());
  }, []);

  return {
    activeFields,
    selections,
    textInputs,
    filter,
    addField,
    removeField,
    toggleValue,
    setText,
    applyValue,
    reset,
  };
}
