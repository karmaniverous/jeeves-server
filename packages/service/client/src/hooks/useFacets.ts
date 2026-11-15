/**
 * The search facets manifest, loaded lazily once and cleaned of garbage
 * values.
 */
import { useCallback, useRef, useState } from 'react';

import type { FacetsResponse, SearchFacet } from '@/lib/apiTypes';
import { type GarbageEntry, partitionFacets } from '@/lib/searchFacets';
import { server } from '@/lib/server';

/** The facets state and its lazy loader. */
export interface Facets {
  facets: SearchFacet[];
  facetsLoading: boolean;
  garbageEntries: GarbageEntry[];
  /** Load the manifest; only the first call fetches. */
  loadFacets: () => Promise<void>;
}

/** Load the search facets manifest on first demand. */
export function useFacets(): Facets {
  const [facets, setFacets] = useState<SearchFacet[]>([]);
  const [facetsLoading, setFacetsLoading] = useState(false);
  const [garbageEntries, setGarbageEntries] = useState<GarbageEntry[]>([]);
  const facetsLoadedRef = useRef(false);

  const loadFacets = useCallback(async () => {
    if (facetsLoadedRef.current) return;
    facetsLoadedRef.current = true;
    setFacetsLoading(true);
    try {
      const res = (await server.searchFacets()) as FacetsResponse;
      const { cleaned, garbage } = partitionFacets(res.facets);
      console.log(
        '[SearchModal] Loaded facets:',
        cleaned.length,
        'clean,',
        garbage.length,
        'garbage entries',
      );
      setFacets(cleaned);
      setGarbageEntries(garbage);
    } catch (err) {
      console.error('Failed to load facets:', err);
      setFacets([]);
    } finally {
      setFacetsLoading(false);
    }
  }, []);

  return { facets, facetsLoading, garbageEntries, loadFacets };
}
