import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight, FileText, Plus, RotateCcw, Search, X } from 'lucide-react';

import { fetchFacets, searchDocuments, type SearchFacet, type SearchResult } from '@/lib/api';

/** Enumerated facets with ≤ this many values render as chips; above → searchable dropdown */
const CHIP_THRESHOLD = 8;

/** Filter out empty, garbage, and unresolved template values */
function cleanFacetValues(values: string[]): string[] {
  return values.filter((v) => {
    const s = String(v ?? '');
    if (!s || !s.trim()) return false;
    if (s.includes('[object Object]')) return false;
    if (/^\$\{.*\}$/.test(s)) return false;
    return true;
  });
}

function formatFieldLabel(field: string): string {
  return field.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

interface GarbageEntry {
  field: string;
  removed: string[];
  reason: string;
}

interface SearchModalProps {
  open: boolean;
  onClose: () => void;
}

// ─── Sub-components ───────────────────────────────────────────────────────

function FilterChips({
  label,
  values,
  selected,
  onToggle,
  onRemove,
}: {
  label: string;
  values: string[];
  selected: Set<string>;
  onToggle: (value: string) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-xs text-muted-foreground font-medium">{label}:</span>
      {values.map((v) => (
        <button
          key={v}
          onClick={() => onToggle(v)}
          className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
            selected.has(v)
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-muted text-muted-foreground border-border hover:bg-accent'
          }`}
        >
          {v}
        </button>
      ))}
      <button onClick={onRemove} className="text-muted-foreground hover:text-foreground ml-0.5" title={`Remove ${label} filter`}>
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

function SearchableSelect({
  label,
  values,
  selected,
  onToggle,
  multi,
  onRemove,
}: {
  label: string;
  values: string[];
  selected: Set<string>;
  onToggle: (value: string) => void;
  multi: boolean;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setFilter('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const filtered = filter
    ? values.filter((v) => v.toLowerCase().includes(filter.toLowerCase()))
    : values;

  const selectedLabel =
    selected.size === 0 ? 'All'
      : selected.size <= 2 ? [...selected].join(', ')
        : `${selected.size} selected`;

  return (
    <div className="flex items-center gap-1.5" ref={containerRef}>
      <span className="text-xs text-muted-foreground font-medium">{label}:</span>
      <div className="relative">
        <button
          onClick={() => setOpen(!open)}
          className={`text-xs px-2 py-0.5 rounded border transition-colors flex items-center gap-1 min-w-[100px] ${
            selected.size > 0
              ? 'bg-primary/10 text-primary border-primary'
              : 'bg-muted text-muted-foreground border-border hover:bg-accent'
          }`}
        >
          <span className="truncate max-w-[200px]">{selectedLabel}</span>
          <ChevronDown className="h-3 w-3 shrink-0" />
        </button>
        {open && (
          <div className="absolute top-full left-0 mt-1 z-50 bg-background border border-border rounded shadow-lg w-64 max-h-48 flex flex-col">
            <div className="p-1.5 border-b border-border">
              <input
                type="text"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Search..."
                className="text-xs w-full px-2 py-1 rounded border border-border bg-muted text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
                autoFocus
              />
            </div>
            <div className="overflow-y-auto flex-1">
              {filtered.length === 0 && (
                <div className="px-3 py-2 text-xs text-muted-foreground">No matches</div>
              )}
              {filtered.map((v) => (
                <button
                  key={v}
                  onClick={() => {
                    onToggle(v);
                    if (!multi) { setOpen(false); setFilter(''); }
                  }}
                  className={`w-full text-left text-xs px-3 py-1.5 hover:bg-accent transition-colors flex items-center gap-2 ${
                    selected.has(v) ? 'bg-primary/10 text-primary' : 'text-foreground'
                  }`}
                >
                  {multi && (
                    <span className={`w-3 h-3 rounded-sm border flex items-center justify-center shrink-0 ${
                      selected.has(v) ? 'bg-primary border-primary' : 'border-border'
                    }`}>
                      {selected.has(v) && <span className="text-[8px] text-primary-foreground">&#10003;</span>}
                    </span>
                  )}
                  <span className="truncate">{v}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      {selected.size > 0 && selected.size <= 5 && [...selected].map((v) => (
        <button
          key={v}
          onClick={() => onToggle(v)}
          className="text-xs px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 flex items-center gap-0.5"
          title={`Remove ${v}`}
        >
          <span className="truncate max-w-[120px]">{v}</span>
          <X className="h-2.5 w-2.5 shrink-0" />
        </button>
      ))}
      <button onClick={onRemove} className="text-muted-foreground hover:text-foreground ml-0.5" title={`Remove ${label} filter`}>
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

function FacetTextInput({
  label,
  value,
  onChange,
  inputType = 'text',
  onRemove,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  inputType?: 'text' | 'number';
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground font-medium">{label}:</span>
      <input
        type={inputType}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`Filter by ${label.toLowerCase()}...`}
        className="text-xs px-2 py-0.5 rounded border border-border bg-muted text-foreground placeholder:text-muted-foreground w-64 outline-none focus:border-primary"
      />
      <button onClick={onRemove} className="text-muted-foreground hover:text-foreground" title={`Remove ${label} filter`}>
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

function ResultRow({ result, onNavigate }: { result: SearchResult; onNavigate: (path: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const preview = result.chunks[0]?.text ?? '';
  const truncatedPreview = preview.length > 150 ? preview.slice(0, 150) + '…' : preview;

  return (
    <div className="border-b border-border last:border-0 px-4 py-2">
      <div className="flex items-start gap-2">
        <FileText className="h-4 w-4 text-zinc-400 shrink-0 mt-1" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigate(`/browse/${result.browsePath}`)}
              className="text-blue-500 hover:underline text-sm font-medium truncate"
            >
              {result.fileName}
            </button>
            {result.domains && result.domains.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                {result.domains.join(', ')}
              </span>
            )}
            <span className="text-[10px] text-muted-foreground shrink-0">
              {(result.bestScore * 100).toFixed(0)}%
            </span>
            <span className="text-[10px] text-muted-foreground shrink-0">
              {result.chunks.length} chunk{result.chunks.length !== 1 ? 's' : ''}
            </span>
            {result.mtime && (
              <span className="text-[10px] text-muted-foreground shrink-0">
                {new Date(result.mtime).toLocaleDateString()}
              </span>
            )}
            <button
              onClick={() => setExpanded(!expanded)}
              className="ml-auto text-muted-foreground hover:text-foreground shrink-0"
              title={expanded ? 'Collapse chunks' : 'Expand chunks'}
            >
              {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 break-words leading-relaxed">
            {result.browsePath}
          </div>
          {!expanded && (
            <div className="text-sm text-foreground/70 mt-1 truncate">{truncatedPreview}</div>
          )}
          {expanded && (
            <div className="mt-2 max-h-48 overflow-y-auto border border-border rounded bg-muted/30 divide-y divide-border">
              {result.chunks.map((chunk, i) => (
                <div key={i} className="px-3 py-2 text-sm text-foreground/80 leading-relaxed">
                  <span className="text-[10px] text-muted-foreground mr-2">#{chunk.index}</span>
                  {chunk.text}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────

export function SearchModal({ open, onClose }: SearchModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Schema-driven facets (lazy-loaded)
  const [facets, setFacets] = useState<SearchFacet[]>([]);
  const [facetsLoading, setFacetsLoading] = useState(false);
  const facetsLoadedRef = useRef(false);
  const [facetSelections, setFacetSelections] = useState<Record<string, Set<string>>>({});
  const [facetTextInputs, setFacetTextInputs] = useState<Record<string, string>>({});
  const [activeFacetFields, setActiveFacetFields] = useState<Set<string>>(new Set());
  const [garbageEntries, setGarbageEntries] = useState<GarbageEntry[]>([]);
  const [showGarbage, setShowGarbage] = useState(false);
  const [addFilterOpen, setAddFilterOpen] = useState(false);
  const [addFilterSearch, setAddFilterSearch] = useState('');
  const addFilterRef = useRef<HTMLDivElement>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Close "Add filter" on outside click
  useEffect(() => {
    if (!addFilterOpen) return;
    const handler = (e: MouseEvent) => {
      if (addFilterRef.current && !addFilterRef.current.contains(e.target as Node)) {
        setAddFilterOpen(false);
        setAddFilterSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [addFilterOpen]);

  const loadFacets = useCallback(async () => {
    if (facetsLoadedRef.current) return;
    facetsLoadedRef.current = true;
    setFacetsLoading(true);
    try {
      const res = await fetchFacets();
      const cleaned: SearchFacet[] = [];
      const garbage: GarbageEntry[] = [];
      for (const f of res.facets) {
        if (f.uiHint === 'hidden') continue;
        // Text/number facets use free-text input — values array is irrelevant
        if (f.uiHint === 'text' || f.uiHint === 'number') {
          cleaned.push({ ...f, values: [] });
          continue;
        }
        const goodValues = cleanFacetValues(f.values);
        const badValues = f.values.filter((v) => !goodValues.includes(v));
        if (badValues.length > 0) {
          const reasons = badValues.map((v) => {
            if (!v || !String(v).trim()) return 'empty';
            if (String(v).includes('[object Object]')) return 'object-to-string';
            if (/^\$\{.*\}$/.test(String(v))) return 'unresolved-template';
            return 'unknown';
          });
          garbage.push({
            field: f.field,
            removed: badValues.map((v, i) => `${JSON.stringify(v)} (${reasons[i]})`),
            reason: [...new Set(reasons)].join(', '),
          });
        }
        if (goodValues.length > 0) {
          cleaned.push({ ...f, values: goodValues });
        } else {
          // All values were garbage — include facet with empty values but log it
          garbage.push({
            field: f.field,
            removed: badValues.length > 0 ? ['(all values filtered)'] : ['(no values)'],
            reason: badValues.length > 0 ? 'no valid values remain' : 'empty values array',
          });
        }
      }
      console.log('[SearchModal] Loaded facets:', cleaned.length, 'clean,', garbage.length, 'garbage entries');
      setFacets(cleaned);
      setGarbageEntries(garbage);
    } catch (err) {
      console.error("Failed to load facets:", err);
      setFacets([]);
    } finally {
      setFacetsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      void loadFacets();
    }
  }, [open, loadFacets]);

  const resetSearch = useCallback(() => {
    setQuery('');
    setResults([]);
    setError(null);
    setFacetSelections({});
    setFacetTextInputs({});
    setActiveFacetFields(new Set());
    setShowGarbage(false);
    inputRef.current?.focus();
  }, []);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const mustClauses: Record<string, unknown>[] = [];
      for (const [field, selected] of Object.entries(facetSelections)) {
        if (selected.size > 0) {
          mustClauses.push({ key: field, match: { any: [...selected] } });
        }
      }
      for (const [field, text] of Object.entries(facetTextInputs)) {
        if (text.trim()) {
          mustClauses.push({ key: field, match: { text: text.trim() } });
        }
      }
      const filter = mustClauses.length > 0 ? { must: mustClauses } : undefined;
      const res = await searchDocuments(q, 30, filter);
      setResults(res.results);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [facetSelections, facetTextInputs]);

  const handleInputChange = useCallback((value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void doSearch(value), 400);
  }, [doSearch]);

  const handleNavigate = useCallback((path: string) => {
    onClose();
    navigate(path);
  }, [navigate, onClose]);

  const toggleFacet = useCallback((field: string, value: string) => {
    setFacetSelections((prev) => {
      const current = prev[field] ?? new Set<string>();
      const next = new Set(current);
      if (next.has(value)) next.delete(value); else next.add(value);
      return { ...prev, [field]: next };
    });
  }, []);

  const addFacetField = useCallback((field: string) => {
    setActiveFacetFields((prev) => new Set([...prev, field]));
  }, []);

  const removeFacetField = useCallback((field: string) => {
    setActiveFacetFields((prev) => { const n = new Set(prev); n.delete(field); return n; });
    setFacetSelections((prev) => { const n = { ...prev }; delete n[field]; return n; });
    setFacetTextInputs((prev) => { const n = { ...prev }; delete n[field]; return n; });
  }, []);

  // Re-search when selections change
  useEffect(() => {
    if (query.trim()) void doSearch(query);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facetSelections, facetTextInputs]);

  const activeFacets = facets.filter((f) => activeFacetFields.has(f.field));
  const inactiveFacets = facets.filter((f) => !activeFacetFields.has(f.field));
  const filteredInactive = addFilterSearch
    ? inactiveFacets.filter((f) => formatFieldLabel(f.field).toLowerCase().includes(addFilterSearch.toLowerCase()))
    : inactiveFacets;

  function renderFacet(f: SearchFacet) {
    const label = formatFieldLabel(f.field);
    const remove = () => removeFacetField(f.field);

    if (f.uiHint === 'text' || f.uiHint === 'number') {
      return (
        <FacetTextInput
          key={f.field}
          label={label}
          value={facetTextInputs[f.field] ?? ''}
          onChange={(v) => setFacetTextInputs((prev) => ({ ...prev, [f.field]: v }))}
          inputType={f.uiHint === 'number' ? 'number' : 'text'}
          onRemove={remove}
        />
      );
    }

    const sel = facetSelections[f.field] ?? new Set<string>();
    if (f.values.length <= CHIP_THRESHOLD) {
      return (
        <FilterChips key={f.field} label={label} values={f.values} selected={sel}
          onToggle={(v) => toggleFacet(f.field, v)} onRemove={remove} />
      );
    }

    return (
      <SearchableSelect key={f.field} label={label} values={f.values} selected={sel}
        onToggle={(v) => toggleFacet(f.field, v)} multi={f.uiHint === 'multiselect'} onRemove={remove} />
    );
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[5vh]" onClick={onClose}>
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
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
            placeholder="Search documents..."
            className="flex-1 bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
          />
          {loading && <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />}
          {(query || results.length > 0) && (
            <button onClick={resetSearch} className="text-muted-foreground hover:text-foreground" title="Reset search">
              <RotateCcw className="h-4 w-4" />
            </button>
          )}
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" title="Close (Esc)">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Active facet filters + Add filter button */}
        <div className="px-4 py-2 border-b border-border flex flex-col gap-1.5">
          {activeFacets.map(renderFacet)}
          <div className="flex items-center gap-2">
            <div className="relative" ref={addFilterRef}>
              <button
                onClick={() => {
                  if (!addFilterOpen) void loadFacets();
                  setAddFilterOpen(!addFilterOpen);
                }}
                className="text-xs px-2 py-0.5 rounded border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-foreground transition-colors flex items-center gap-1"
              >
                <Plus className="h-3 w-3" />
                {facetsLoading ? 'Loading filters...' : 'Add filter'}
              </button>
              {addFilterOpen && (
                <div className="absolute top-full left-0 mt-1 z-50 bg-background border border-border rounded shadow-lg w-56 max-h-48 flex flex-col">
                  <div className="p-1.5 border-b border-border">
                    <input
                      type="text"
                      value={addFilterSearch}
                      onChange={(e) => setAddFilterSearch(e.target.value)}
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
                        {facets.length === 0 ? 'No filters available' : 'All filters active'}
                      </div>
                    )}
                    {filteredInactive.map((f) => (
                      <button
                        key={f.field}
                        onClick={() => {
                          addFacetField(f.field);
                          setAddFilterOpen(false);
                          setAddFilterSearch('');
                        }}
                        className="w-full text-left text-xs px-3 py-1.5 hover:bg-accent transition-colors flex items-center justify-between"
                      >
                        <span>{formatFieldLabel(f.field)}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {f.uiHint === 'text' || f.uiHint === 'number' ? f.uiHint : `${f.values.length}`}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {garbageEntries.length > 0 && (
              <button
                onClick={() => setShowGarbage(!showGarbage)}
                className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 border border-amber-500/30 hover:bg-amber-500/20 transition-colors"
                title="Show inference rule issues"
              >
                {garbageEntries.length} issue{garbageEntries.length !== 1 ? 's' : ''}
              </button>
            )}
          </div>
          {showGarbage && garbageEntries.length > 0 && (
            <div className="mt-1 p-2 rounded border border-amber-500/30 bg-amber-500/5 text-xs max-h-32 overflow-y-auto">
              <div className="text-amber-600 font-medium mb-1">Filtered facet values (inference rule issues):</div>
              {garbageEntries.map((g) => (
                <div key={g.field} className="mb-1">
                  <span className="text-foreground font-medium">{formatFieldLabel(g.field)}</span>
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
          )}
        </div>

        {/* Results */}
        <div className="overflow-y-auto flex-1">
          {error && <div className="px-4 py-3 text-sm text-red-500">{error}</div>}
          {!error && results.length === 0 && query.trim() && !loading && (
            <div className="px-4 py-8 text-center text-muted-foreground text-sm">No results found</div>
          )}
          {!error && !query.trim() && !loading && (
            <div className="px-4 py-8 text-center text-muted-foreground text-sm">
              Type a query to search across all documents
            </div>
          )}
          {results.map((r) => (
            <ResultRow key={r.browsePath} result={r} onNavigate={handleNavigate} />
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
