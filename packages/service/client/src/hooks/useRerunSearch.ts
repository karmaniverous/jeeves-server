/**
 * Re-runs a search with the current query when its filters change (the
 * search callback changes identity), not when the query alone changes.
 */
import { useEffect } from 'react';

import { useLatestRef } from './useLatestRef';

/**
 * Call `search` with the current query whenever `search` changes identity
 * and the query isn't blank. Typing alone (a new `query`, same `search`)
 * doesn't trigger it: the caller debounces that.
 */
export function useRerunSearch(
  query: string,
  search: (query: string) => Promise<void>,
): void {
  const queryRef = useLatestRef(query);
  useEffect(() => {
    const q = queryRef.current;
    if (q.trim())
      queueMicrotask(() => {
        void search(q);
      });
  }, [search, queryRef]);
}
