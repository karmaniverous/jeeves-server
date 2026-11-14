import type { FacetFilters } from '@/hooks/useFacetFilters';
import type { Facets } from '@/hooks/useFacets';

import { AddFilterMenu } from './AddFilterMenu';
import { FacetFilter } from './FacetFilter';
import { FacetIssuesButton, FacetIssuesList } from './FacetIssues';

/**
 * The search modal's filter bar: the active facet filters, the "Add
 * filter" menu and the facet-issues toggle and list.
 */
export function FacetBar({
  facets: { facets, facetsLoading, garbageEntries, loadFacets },
  filters,
  showIssues,
  onToggleIssues,
}: {
  facets: Facets;
  filters: FacetFilters;
  showIssues: boolean;
  onToggleIssues: () => void;
}) {
  const activeFacets = facets.filter((f) => filters.activeFields.has(f.field));

  return (
    <div className="px-4 py-2 border-b border-border flex flex-col gap-1.5">
      {activeFacets.map((f) => (
        <FacetFilter
          key={f.field}
          facet={f}
          selected={filters.selections[f.field] ?? new Set<string>()}
          text={filters.textInputs[f.field] ?? ''}
          onToggle={(v) => filters.toggleValue(f.field, v)}
          onTextChange={(v) => filters.setText(f.field, v)}
          onRemove={() => filters.removeField(f.field)}
        />
      ))}
      <div className="flex items-center gap-2">
        <AddFilterMenu
          facets={facets}
          activeFields={filters.activeFields}
          facetsLoading={facetsLoading}
          loadFacets={loadFacets}
          onAdd={filters.addField}
        />
        <FacetIssuesButton
          count={garbageEntries.length}
          onToggle={onToggleIssues}
        />
      </div>
      {showIssues && <FacetIssuesList entries={garbageEntries} />}
    </div>
  );
}
