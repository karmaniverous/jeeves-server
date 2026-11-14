import { formatFieldLabel, type GarbageEntry } from '@/lib/searchFacets';

/** The "N issues" toggle for the facet values filtered out as garbage. */
export function FacetIssuesButton({
  count,
  onToggle,
}: {
  count: number;
  onToggle: () => void;
}) {
  if (count === 0) return null;
  return (
    <button
      onClick={onToggle}
      className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 border border-amber-500/30 hover:bg-amber-500/20 transition-colors"
      title="Show inference rule issues"
    >
      {count} issue
      {count !== 1 ? 's' : ''}
    </button>
  );
}

/** The facet values filtered out as garbage, by field. */
export function FacetIssuesList({ entries }: { entries: GarbageEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <div className="mt-1 p-2 rounded border border-amber-500/30 bg-amber-500/5 text-xs max-h-32 overflow-y-auto">
      <div className="text-amber-600 font-medium mb-1">
        Filtered facet values (inference rule issues):
      </div>
      {entries.map((g) => (
        <div key={g.field} className="mb-1">
          <span className="text-foreground font-medium">
            {formatFieldLabel(g.field)}
          </span>
          <span className="text-muted-foreground">: </span>
          {g.removed.map((r, i) => (
            <span key={i} className="text-amber-700">
              {i > 0 && ', '}
              <code className="bg-amber-500/10 px-0.5 rounded">{r}</code>
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
