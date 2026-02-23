import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight, FileText, Search, X } from 'lucide-react';

import { searchDocuments, type SearchResult, type SearchMetadata } from '@/lib/api';

interface SearchModalProps {
  open: boolean;
  onClose: () => void;
}

function FilterChips({
  label,
  values,
  selected,
  onToggle,
}: {
  label: string;
  values: string[];
  selected: Set<string>;
  onToggle: (value: string) => void;
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
    </div>
  );
}

function ResultRow({ result, onNavigate }: { result: SearchResult; onNavigate: (path: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const allText = result.chunks.map((c) => c.text).join(' … ');
  const truncated = allText.length > 200 ? allText.slice(0, 200) : allText;
  const needsExpand = allText.length > 200;

  return (
    <div className="border-b border-border last:border-0 px-4 py-3 hover:bg-accent/50 transition-colors">
      <div className="flex items-start gap-2">
        <FileText className="h-4 w-4 text-zinc-400 shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigate(`/browse/${result.browsePath}`)}
              className="text-blue-500 hover:underline text-sm font-medium truncate"
            >
              {result.fileName}
            </button>
            {result.domain && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                {result.domain}
              </span>
            )}
            <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
              {(result.bestScore * 100).toFixed(0)}%
            </span>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 break-words leading-relaxed">
            {result.browsePath}
          </div>
          <div className="text-sm text-foreground/80 mt-1 leading-relaxed">
            {expanded ? allText : truncated}
            {needsExpand && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="inline-flex items-center gap-0.5 text-blue-500 hover:underline ml-1 text-xs"
              >
                {expanded ? (
                  <>less <ChevronRight className="h-3 w-3" /></>
                ) : (
                  <>more <ChevronDown className="h-3 w-3" /></>
                )}
              </button>
            )}
          </div>
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
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setResults([]);
      setMetadata({ domains: [], authors: [], participants: [] });
      setError(null);
      setDomainFilter(new Set());
      setAuthorFilter(new Set());
    }
  }, [open]);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setMetadata({ domains: [], authors: [], participants: [] });
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await searchDocuments(q, 30);
      setResults(res.results);
      setMetadata(res.metadata);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

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

  // Apply client-side filters
  const filtered = results.filter((r) => {
    if (domainFilter.size > 0 && (!r.domain || !domainFilter.has(r.domain))) return false;
    if (authorFilter.size > 0 && (!r.author || !authorFilter.has(r.author))) return false;
    return true;
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative bg-background border border-border rounded-lg shadow-2xl w-full max-w-2xl max-h-[70vh] flex flex-col"
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
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Filter chips */}
        {(metadata.domains.length > 0 || metadata.authors.length > 0) && (
          <div className="px-4 py-2 border-b border-border flex flex-col gap-1.5">
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
