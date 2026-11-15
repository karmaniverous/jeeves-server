import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RotateCcw, Search, X } from 'lucide-react';

import { useFacetFilters } from '@/hooks/useFacetFilters';
import { useFacets } from '@/hooks/useFacets';
import { useSearch } from '@/hooks/useSearch';

import { FacetBar } from './search/FacetBar';
import { ResultRow } from './search/ResultRow';

interface SearchModalProps {
  open: boolean;
  onClose: () => void;
}

/** The search modal: query, facet filters and results. */
export function SearchModal({ open, onClose }: SearchModalProps) {
  const facetState = useFacets();
  const { facets, loadFacets } = facetState;
  const filters = useFacetFilters();
  const { applyValue, reset: resetFilters } = filters;
  const search = useSearch(filters.filter);
  const { query, results, loading, error, reset: resetQuery } = search;
  const [showIssues, setShowIssues] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      queueMicrotask(() => {
        void loadFacets();
      });
    }
  }, [open, loadFacets]);

  const resetSearch = useCallback(() => {
    resetQuery();
    resetFilters();
    setShowIssues(false);
    inputRef.current?.focus();
  }, [resetQuery, resetFilters]);

  const handleNavigate = useCallback(
    (path: string) => {
      onClose();
      navigate(path);
    },
    [navigate, onClose],
  );

  const handleChipClick = useCallback(
    (field: string, value: string) => {
      applyValue(
        facets.find((f) => f.field === field),
        field,
        value,
      );
    },
    [facets, applyValue],
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[5vh]"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative bg-background border border-border rounded-lg shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search className="h-5 w-5 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => search.setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
            }}
            placeholder="Search documents..."
            className="flex-1 bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
          />
          {loading && (
            <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          )}
          {(query || results.length > 0) && (
            <button
              onClick={resetSearch}
              className="text-muted-foreground hover:text-foreground"
              title="Reset search"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            title="Close (Esc)"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Active facet filters + Add filter button */}
        <FacetBar
          facets={facetState}
          filters={filters}
          showIssues={showIssues}
          onToggleIssues={() => setShowIssues(!showIssues)}
        />

        {/* Results */}
        <div className="overflow-y-auto flex-1">
          {error && (
            <div className="px-4 py-3 text-sm text-red-500">{error}</div>
          )}
          {!error && results.length === 0 && query.trim() && !loading && (
            <div className="px-4 py-8 text-center text-muted-foreground text-sm">
              No results found
            </div>
          )}
          {!error && !query.trim() && !loading && (
            <div className="px-4 py-8 text-center text-muted-foreground text-sm">
              Type a query to search across all documents
            </div>
          )}
          {results.map((r) => (
            <ResultRow
              key={r.browsePath}
              result={r}
              facets={facets}
              onNavigate={handleNavigate}
              onChipClick={handleChipClick}
            />
          ))}
        </div>

        {/* Footer */}
        {results.length > 0 && (
          <div className="px-4 py-2 border-t border-border text-xs text-muted-foreground">
            {results.length} result{results.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  );
}
