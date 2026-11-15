/**
 * The search modal's query and results: debounced search as the query is
 * typed, an immediate re-run when the filter changes, and a reset.
 */
import { useCallback, useRef, useState } from 'react';

import type { SearchResult } from '@/lib/apiTypes';
import type { SearchFilter } from '@/lib/searchFacets';
import { server } from '@/lib/server';
import { searchErrorMessage } from '@/lib/serverErrors';

import { useRerunSearch } from './useRerunSearch';

/** Delay after the last keystroke before searching. */
export const SEARCH_DEBOUNCE_MS = 400;

/** Most results asked for. */
const SEARCH_LIMIT = 30;

/** The search state and its updaters. */
export interface Search {
  query: string;
  results: SearchResult[];
  loading: boolean;
  error: string | null;
  /** Set the query and search it once typing pauses. */
  setQuery: (query: string) => void;
  /** Clear the query, results and error. */
  reset: () => void;
}

/**
 * Search the server with `filter`, debouncing the typed query and
 * re-running the current query whenever `filter` changes identity.
 */
export function useSearch(filter: SearchFilter | undefined): Search {
  const [query, setQueryState] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const doSearch = useCallback(
    async (q: string) => {
      if (!q.trim()) {
        setResults([]);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await server.search({
          query: q,
          limit: SEARCH_LIMIT,
          ...(filter ? { filter } : {}),
        });
        setResults(res.results);
      } catch (err) {
        setError(searchErrorMessage(err));
      } finally {
        setLoading(false);
      }
    },
    [filter],
  );

  const setQuery = useCallback(
    (value: string) => {
      setQueryState(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(
        () => void doSearch(value),
        SEARCH_DEBOUNCE_MS,
      );
    },
    [doSearch],
  );

  const reset = useCallback(() => {
    setQueryState('');
    setResults([]);
    setError(null);
  }, []);

  // Re-search when the filter changes. doSearch changes exactly when the
  // filter does; the query is read through a ref so typing (debounced in
  // setQuery) doesn't search twice.
  useRerunSearch(query, doSearch);

  return { query, results, loading, error, setQuery, reset };
}
