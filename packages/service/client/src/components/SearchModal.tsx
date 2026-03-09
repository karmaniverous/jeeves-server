import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight, FileText, Plus, RotateCcw, Search, X } from 'lucide-react';

import { fetchFacets, searchDocuments, type SearchFacet, type SearchResult, type SearchMetadata } from '@/lib/api';

type DatePreset = '24h' | '7d' | '30d' | 'custom' | null;

/** Enumerated facets with ≤ this many values render as chips; above → searchable dropdown */
const CHIP_THRESHOLD = 8;

const DATE_PRESETS: { label: string; value: DatePreset }[] = [
  { label: '24h', value: '24h' },
  { label: '7 days', value: '7d' },
  { label: '30 days', value: '30d' },
  { label: 'Custom', value: 'custom' },
];

function getPresetDate(preset: DatePreset): Date | null {
  if (!preset || preset === 'custom') return null;
  const now = new Date();
  if (preset === '24h') return new Date(now.getTime() - 24 * 60 * 60 * 1000);
  if (preset === '7d') return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  if (preset === '30d') return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  return null;
}

/** Filter out empty, garbage, and unresolved template values */
function cleanFacetValues(values: string[]): string[] {
  return values.filter((v) => {
    if (!v || !v.trim()) return false;
    if (v.includes('[object Object]')) return false;
    if (/^\$\{.*\}$/.test(v)) return false;
    return true;
  });
}

/** Clean a facet's values and return null if nothing usable remains */
function cleanFacet(f: SearchFacet): SearchFacet | null {
  if (f.uiHint === 'hidden') return null;
  const cleaned = cleanFacetValues(f.values);
  if (cleaned.length === 0) return null;
  return { ...f, values: cleaned };
}

function formatFieldLabel(field: string): string {
  return field.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

interface SearchModalProps {
  open: boolean;
  onClose: () => void;
}

function FilterChips({
  label,
  values,
  selected,
  onToggle,
  onRemoveFacet,
}: {
  label: string;
  values: string[];
  selected: Set<string>;
  onToggle: (value: string) => void;
  onRemoveFacet?: () => void;
}) {
  if (values.length === 0) return null;
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
      {onRemoveFacet && (
        <button
          onClick={onRemoveFacet}
          className="text-muted-foreground hover:text-foreground ml-0.5"
          title={`Remove ${label} filter`}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

/**
 * Searchable dropdown for enumerated facets with many values.
 */
function SearchableSelect({
  label,
  values,
  selected,
  onToggle,
  multi,
  onRemoveFacet,
}: {
  label: string;
  values: string[];
  selected: Set<string>;
  onToggle: (value: string) => void;
  multi: boolean;
  onRemoveFacet?: () => void;
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
    selected.size === 0
      ? 'All'
      : selected.size <= 2
        ? [...selected].join(', ')
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
                    if (!multi) {
                      setOpen(false);
                      setFilter('');
                    }
                  }}
                  className={`w-full text-left text-xs px-3 py-1.5 hover:bg-accent transition-colors flex items-center gap-2 ${
                    selected.has(v) ? 'bg-primary/10 text-primary' : 'text-foreground'
                  }`}
                >
                  {multi && (
                    <span
                      className={`w-3 h-3 rounded-sm border flex items-center justify-center shrink-0 ${
                        selected.has(v) ? 'bg-primary border-primary' : 'border-border'
                      }`}
                    >
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
      {/* Removable pills for selections */}
      {selected.size > 0 && selected.size <= 5 && (
        <>
          {[...selected].map((v) => (
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
        </>
      )}
      {onRemoveFacet && (
        <button
          onClick={onRemoveFacet}
          className="text-muted-foreground hover:text-foreground ml-0.5"
          title={`Remove ${label} filter`}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

/**
 * Free-text input for text/number facets.
 */
function FacetTextInput({
  label,
  value,
  onChange,
  inputType = 'text',
  onRemoveFacet,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  inputType?: 'text' | 'number';
  onRemoveFacet?: () => void;
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
      {onRemoveFacet && (
        <button
          onClick={onRemoveFacet}
          className="text-muted-foreground hover:text-foreground"
          title={`Remove ${label} filter`}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

/**
 * "Add Filter" dropdown — lets user pick which facets to activate.
 */
function AddFilterMenu({
  availableFacets,
  activeFacets,
  onAdd,
}: {
  availableFacets: SearchFacet[];
  activeFacets: Set<string>;
  onAdd: (field: string) => void;
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

  const inactive = availableFacets.filter((f) => !activeFacets.has(f.field));
  const filtered = filter
    ? inactive.filter((f) =>
        formatFieldLabel(f.field).toLowerCase().includes(filter.toLowerCase()),
      )
    : inactive;

  if (inactive.length === 0) return null;

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen(!open)}
        className="text-xs px-2 py-0.5 rounded border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-foreground transition-colors flex items-center gap-1"
      >
        <Plus className="h-3 w-3" />
        Add filter
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-background border border-border rounded shadow-lg w-56 max-h-48 flex flex-col">
          <div className="p-1.5 border-b border-border">
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search filters..."
              className="text-xs w-full px-2 py-1 rounded border border-border bg-muted text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
              autoFocus
            />
          </div>
          <div className="overflow-y-auto flex-1">
            {filtered.length === 0 && (
              <div className="px-3 py-2 text-xs text-muted-foreground">No filters available</div>
            )}
            {filtered.map((f) => (
              <button
                key={f.field}
                onClick={() => {
                  onAdd(f.field);
                  setOpen(false);
                  setFilter('');
                }}
                className="w-full text-left text-xs px-3 py-1.5 hover:bg-accent transition-colors flex items-center justify-between"
              >
                <span>{formatFieldLabel(f.field)}</span>
                <span className="text-[10px] text-muted-foreground">
                  {f.uiHint === 'text' || f.uiHint === 'number'
                    ? f.uiHint
                    : `${f.values.length} values`}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
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
            <div className="text-sm text-foreground/70 mt-1 truncate">
              {truncatedPreview}
            </div>
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

export function SearchModal({ open, onClose }: SearchModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [metadata, setMetadata] = useState<SearchMetadata>({ domains: [], authors: [], participants: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [domainFilter, setDomainFilter] = useState<Set<string>>(new Set());
  const [authorFilter, setAuthorFilter] = useState<Set<string>>(new Set());
  const [extFilter, setExtFilter] = useState<Set<string>>(new Set());
  const [datePreset, setDatePreset] = useState<DatePreset>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [facets, setFacets] = useState<SearchFacet[]>([]);
  const [facetSelections, setFacetSelections] = useState<Record<string, Set<string>>>({});
  const [facetTextInputs, setFacetTextInputs] = useState<Record<string, string>>({});
  /** Which facets the user has chosen to display */
  const [activeFacetFields, setActiveFacetFields] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      void fetchFacets()
        .then((res) => {
          const cleaned = res.facets.map(cleanFacet).filter((f): f is SearchFacet => f !== null);
          setFacets(cleaned);
        })
        .catch(() => setFacets([]));
    }
  }, [open]);

  const resetSearch = useCallback(() => {
    setQuery('');
    setResults([]);
    setMetadata({ domains: [], authors: [], participants: [] });
    setError(null);
    setDomainFilter(new Set());
    setAuthorFilter(new Set());
    setExtFilter(new Set());
    setDatePreset(null);
    setDateFrom('');
    setDateTo('');
    setFacetSelections({});
    setFacetTextInputs({});
    setActiveFacetFields(new Set());
    inputRef.current?.focus();
  }, []);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setMetadata({ domains: [], authors: [], participants: [] });
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const mustClauses: Record<string, unknown>[] = [];
      for (const [field, selected] of Object.entries(facetSelections)) {
        if (selected.size > 0) {
          mustClauses.push({
            key: field,
            match: { any: [...selected] },
          });
        }
      }
      for (const [field, text] of Object.entries(facetTextInputs)) {
        if (text.trim()) {
          mustClauses.push({
            key: field,
            match: { text: text.trim() },
          });
        }
      }
      const filter = mustClauses.length > 0
        ? { must: mustClauses }
        : undefined;
      const res = await searchDocuments(q, 30, filter);
      setResults(res.results);
      setMetadata(res.metadata);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [facetSelections, facetTextInputs]);

  const handleInputChange = useCallback(
    (value: string) => {
      setQuery(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => void doSearch(value), 400);
    },
    [doSearch],
  );

  const handleNavigate = useCallback(
    (path: string) => {
      onClose();
      navigate(path);
    },
    [navigate, onClose],
  );

  const toggleFilter = useCallback(
    (set: Set<string>, setFn: React.Dispatch<React.SetStateAction<Set<string>>>, value: string) => {
      const next = new Set(set);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      setFn(next);
    },
    [],
  );

  const toggleFacet = useCallback(
    (field: string, value: string) => {
      setFacetSelections((prev) => {
        const current = prev[field] ?? new Set<string>();
        const next = new Set(current);
        if (next.has(value)) next.delete(value);
        else next.add(value);
        return { ...prev, [field]: next };
      });
    },
    [],
  );

  const addFacetField = useCallback((field: string) => {
    setActiveFacetFields((prev) => new Set([...prev, field]));
  }, []);

  const removeFacetField = useCallback((field: string) => {
    setActiveFacetFields((prev) => {
      const next = new Set(prev);
      next.delete(field);
      return next;
    });
    // Clear any selections for this facet
    setFacetSelections((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
    setFacetTextInputs((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  // Re-search when facet selections or text inputs change
  useEffect(() => {
    if (query.trim()) {
      void doSearch(query);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facetSelections, facetTextInputs]);

  const extensions = [...new Set(results.map((r) => {
    const dot = r.fileName.lastIndexOf('.');
    return dot > 0 ? r.fileName.slice(dot).toLowerCase() : '(none)';
  }))].sort();

  const effectiveDateFrom = datePreset && datePreset !== 'custom'
    ? getPresetDate(datePreset)
    : dateFrom ? new Date(dateFrom) : null;
  const effectiveDateTo = datePreset === 'custom' && dateTo
    ? new Date(dateTo + 'T23:59:59.999Z') : null;

  const filtered = results.filter((r) => {
    if (domainFilter.size > 0 && (!r.domains || !r.domains.some(d => domainFilter.has(d)))) return false;
    if (authorFilter.size > 0 && (!r.author || !authorFilter.has(r.author))) return false;
    if (extFilter.size > 0) {
      const dot = r.fileName.lastIndexOf('.');
      const ext = dot > 0 ? r.fileName.slice(dot).toLowerCase() : '(none)';
      if (!extFilter.has(ext)) return false;
    }
    if (effectiveDateFrom && r.mtime) {
      if (new Date(r.mtime) < effectiveDateFrom) return false;
    }
    if (effectiveDateTo && r.mtime) {
      if (new Date(r.mtime) > effectiveDateTo) return false;
    }
    return true;
  });

  /** Active facets the user has chosen to display */
  const activeFacets = facets.filter((f) => activeFacetFields.has(f.field));

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
          onRemoveFacet={remove}
        />
      );
    }

    const sel = facetSelections[f.field] ?? new Set<string>();
    if (f.values.length <= CHIP_THRESHOLD) {
      return (
        <FilterChips
          key={f.field}
          label={label}
          values={f.values}
          selected={sel}
          onToggle={(v) => toggleFacet(f.field, v)}
          onRemoveFacet={remove}
        />
      );
    }

    return (
      <SearchableSelect
        key={f.field}
        label={label}
        values={f.values}
        selected={sel}
        onToggle={(v) => toggleFacet(f.field, v)}
        multi={f.uiHint === 'multiselect'}
        onRemoveFacet={remove}
      />
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

        {/* Schema-driven facet filters: two-step — "Add filter" button + active facets */}
        {facets.length > 0 && (
          <div className="px-4 py-2 border-b border-border flex flex-col gap-1.5">
            {activeFacets.map(renderFacet)}
            <AddFilterMenu
              availableFacets={facets}
              activeFacets={activeFacetFields}
              onAdd={addFacetField}
            />
          </div>
        )}

        {/* Post-hoc filter chips */}
        {results.length > 0 && (
          <div className="px-4 py-2 border-b border-border flex flex-col gap-1.5">
            <FilterChips
              label="Type"
              values={extensions}
              selected={extFilter}
              onToggle={(v) => toggleFilter(extFilter, setExtFilter, v)}
            />
            <FilterChips
              label="Domain"
              values={metadata.domains}
              selected={domainFilter}
              onToggle={(v) => toggleFilter(domainFilter, setDomainFilter, v)}
            />
            <FilterChips
              label="Author"
              values={metadata.authors}
              selected={authorFilter}
              onToggle={(v) => toggleFilter(authorFilter, setAuthorFilter, v)}
            />
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-muted-foreground font-medium">Date:</span>
              {DATE_PRESETS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setDatePreset(datePreset === p.value ? null : p.value)}
                  className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                    datePreset === p.value
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted text-muted-foreground border-border hover:bg-accent'
                  }`}
                >
                  {p.label}
                </button>
              ))}
              {datePreset === 'custom' && (
                <>
                  <input
                    type="month"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value ? e.target.value + '-01' : '')}
                    className="text-xs px-1.5 py-0.5 rounded border border-border bg-muted text-foreground w-28"
                    placeholder="From"
                  />
                  <span className="text-xs text-muted-foreground">to</span>
                  <input
                    type="month"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value ? e.target.value + '-28' : '')}
                    className="text-xs px-1.5 py-0.5 rounded border border-border bg-muted text-foreground w-28"
                    placeholder="To"
                  />
                </>
              )}
            </div>
          </div>
        )}

        {/* Results */}
        <div className="overflow-y-auto flex-1">
          {error && (
            <div className="px-4 py-3 text-sm text-red-500">{error}</div>
          )}
          {!error && filtered.length === 0 && query.trim() && !loading && (
            <div className="px-4 py-8 text-center text-muted-foreground text-sm">
              No results found
            </div>
          )}
          {!error && !query.trim() && !loading && (
            <div className="px-4 py-8 text-center text-muted-foreground text-sm">
              Type a query to search across all documents
            </div>
          )}
          {filtered.map((r) => (
            <ResultRow key={r.browsePath} result={r} onNavigate={handleNavigate} />
          ))}
        </div>

        {/* Footer */}
        {filtered.length > 0 && (
          <div className="px-4 py-2 border-t border-border text-xs text-muted-foreground">
            {filtered.length} result{filtered.length !== 1 ? 's' : ''}
            {filtered.length < results.length && ` (${results.length} total, ${results.length - filtered.length} filtered)`}
          </div>
        )}
      </div>
    </div>
  );
}
