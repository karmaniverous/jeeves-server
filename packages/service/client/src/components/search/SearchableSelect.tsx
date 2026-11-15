import { useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';

import { useOutsideClick } from '@/hooks/useOutsideClick';

/** An enumerated facet with many values: a searchable dropdown. */
export function SearchableSelect({
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

  const close = () => {
    setOpen(false);
    setFilter('');
  };
  useOutsideClick(containerRef, open, close, true);

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
      <span className="text-xs text-muted-foreground font-medium">
        {label}:
      </span>
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
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  No matches
                </div>
              )}
              {filtered.map((v) => (
                <button
                  key={v}
                  onClick={() => {
                    onToggle(v);
                    if (!multi) close();
                  }}
                  className={`w-full text-left text-xs px-3 py-1.5 hover:bg-accent transition-colors flex items-center gap-2 ${
                    selected.has(v)
                      ? 'bg-primary/10 text-primary'
                      : 'text-foreground'
                  }`}
                >
                  {multi && (
                    <span
                      className={`w-3 h-3 rounded-sm border flex items-center justify-center shrink-0 ${
                        selected.has(v)
                          ? 'bg-primary border-primary'
                          : 'border-border'
                      }`}
                    >
                      {selected.has(v) && (
                        <span className="text-[8px] text-primary-foreground">
                          &#10003;
                        </span>
                      )}
                    </span>
                  )}
                  <span className="truncate">{v}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      {selected.size > 0 &&
        selected.size <= 5 &&
        [...selected].map((v) => (
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
      <button
        onClick={onRemove}
        className="text-muted-foreground hover:text-foreground ml-0.5"
        title={`Remove ${label} filter`}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
