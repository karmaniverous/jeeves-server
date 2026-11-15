import { useRef, useState } from 'react';
import { Plus } from 'lucide-react';

import { useOutsideClick } from '@/hooks/useOutsideClick';
import type { SearchFacet } from '@/lib/apiTypes';
import { formatFieldLabel, isFreeTextFacet } from '@/lib/searchFacets';

/**
 * The "Add filter" button and its searchable menu of the facets not yet
 * active. Opening it loads the facets manifest.
 */
export function AddFilterMenu({
  facets,
  activeFields,
  facetsLoading,
  loadFacets,
  onAdd,
}: {
  facets: SearchFacet[];
  activeFields: Set<string>;
  facetsLoading: boolean;
  loadFacets: () => Promise<void>;
  onAdd: (field: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const close = () => {
    setOpen(false);
    setSearch('');
  };
  useOutsideClick(ref, open, close);

  const inactiveFacets = facets.filter((f) => !activeFields.has(f.field));
  const filteredInactive = search
    ? inactiveFacets.filter((f) =>
        formatFieldLabel(f.field).toLowerCase().includes(search.toLowerCase()),
      )
    : inactiveFacets;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => {
          if (!open) void loadFacets();
          setOpen(!open);
        }}
        className="text-xs px-2 py-0.5 rounded border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-foreground transition-colors flex items-center gap-1"
      >
        <Plus className="h-3 w-3" />
        {facetsLoading ? 'Loading filters...' : 'Add filter'}
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-background border border-border rounded shadow-lg w-56 max-h-48 flex flex-col">
          <div className="p-1.5 border-b border-border">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search filters..."
              className="text-xs w-full px-2 py-1 rounded border border-border bg-muted text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
              autoFocus
            />
          </div>
          <div className="overflow-y-auto flex-1">
            {facetsLoading && (
              <div className="px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
                <div className="h-3 w-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                Loading...
              </div>
            )}
            {!facetsLoading && filteredInactive.length === 0 && (
              <div className="px-3 py-2 text-xs text-muted-foreground">
                {facets.length === 0
                  ? 'No filters available'
                  : 'All filters active'}
              </div>
            )}
            {filteredInactive.map((f) => (
              <button
                key={f.field}
                onClick={() => {
                  onAdd(f.field);
                  close();
                }}
                className="w-full text-left text-xs px-3 py-1.5 hover:bg-accent transition-colors flex items-center justify-between"
              >
                <span className="text-foreground">
                  {formatFieldLabel(f.field)}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {isFreeTextFacet(f) ? f.uiHint : `${f.values.length}`}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
